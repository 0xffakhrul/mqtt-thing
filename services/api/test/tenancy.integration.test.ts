import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@mqtt-thing/logger';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { runner } from 'node-pg-migrate';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type App, buildApp } from '../src/app.js';
import { hashPassword } from '../src/passwords.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const MIGRATIONS = fileURLToPath(new URL('../../../migrations', import.meta.url));

let postgres: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;
let pool: pg.Pool;
let publisher: Redis;
let app: App;

const seed = async (): Promise<void> => {
  const hash = await hashPassword('password');
  await pool.query(`INSERT INTO tenants (id, name) VALUES ('demo', 'Demo'), ('test', 'Test')`);
  await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash)
     VALUES ('demo', 'demo@example.com', $1), ('test', 'test@example.com', $1)`,
    [hash],
  );
  await pool.query(
    `INSERT INTO devices (device_id, tenant_id)
     VALUES ('sim-001', 'demo'), ('sim-002', 'demo'), ('test-001', 'test')`,
  );
  for (const [tenant, device, value] of [
    ['demo', 'sim-001', 27],
    ['test', 'test-001', 19],
  ] as const) {
    await pool.query(
      `INSERT INTO readings (tenant_id, device_id, seq, ts, metric, value)
       VALUES ($1, $2, 1, now() - interval '1 minute', 'temp_c', $3)`,
      [tenant, device, value],
    );
    await pool.query(
      `INSERT INTO latest_readings (tenant_id, device_id, metric, ts, value)
       VALUES ($1, $2, 'temp_c', now() - interval '1 minute', $3)`,
      [tenant, device, value],
    );
  }
};

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');
const forgeToken = (claims: Record<string, unknown>, secret: string): string => {
  const head = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
};

const login = (email: string, password = 'password') =>
  app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

const tokenFor = async (email: string): Promise<string> => (await login(email)).json().token;

const get = (url: string, token?: string) =>
  app.inject({
    method: 'GET',
    url,
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });

beforeAll(async () => {
  [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('timescale/timescaledb:latest-pg17').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);

  await runner({
    databaseUrl: postgres.getConnectionUri(),
    dir: MIGRATIONS,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  });

  pool = new pg.Pool({ connectionString: postgres.getConnectionUri() });
  await seed();

  publisher = new Redis(redis.getConnectionUrl());
  process.env.LOG_LEVEL = 'silent';
  app = await buildApp({
    pool,
    redisUrl: redis.getConnectionUrl(),
    jwtSecret: SECRET,
    jwtExpiresIn: '1h',
    logger: createLogger('api-test'),
  });
  await app.ready();
}, 180_000);

afterAll(async () => {
  await app?.close();
  publisher?.disconnect();
  await pool?.end();
  await Promise.all([postgres?.stop(), redis?.stop()]);
});

describe('authentication', () => {
  it('keeps /health public', async () => {
    expect((await get('/health')).statusCode).toBe(200);
  });

  it.each(['/api/v1/devices', '/api/v1/devices/sim-001/series?metric=temp_c', '/api/v1/auth/me'])(
    'rejects %s without a token',
    async (url) => {
      expect((await get(url)).statusCode).toBe(401);
    },
  );

  it('rejects a token signed with the wrong secret', async () => {
    const forged = forgeToken(
      { sub: 'x', tenantId: 'demo', email: 'demo@example.com' },
      'not-the-real-secret-but-long-enough-to-pass',
    );
    expect((await get('/api/v1/devices', forged)).statusCode).toBe(401);
  });

  it('rejects a real token whose tenant was edited', async () => {
    const [head, payload, signature] = (await tokenFor('demo@example.com')).split('.');
    const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString());
    const tampered = `${head}.${base64url(JSON.stringify({ ...claims, tenantId: 'test' }))}.${signature}`;

    expect((await get('/api/v1/devices', tampered)).statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const expired = forgeToken(
      {
        sub: 'x',
        tenantId: 'demo',
        email: 'demo@example.com',
        iat: past - 60,
        exp: past,
      },
      SECRET,
    );
    expect((await get('/api/v1/devices', expired)).statusCode).toBe(401);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await login('demo@example.com', 'nope');
    const unknownEmail = await login('nobody@example.com');

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(unknownEmail.json()).toEqual(wrongPassword.json());
  });

  it('issues a token that carries the user’s tenant', async () => {
    const response = await login('demo@example.com');
    expect(response.statusCode).toBe(200);

    const me = await get('/api/v1/auth/me', response.json().token);
    expect(me.json()).toEqual({ email: 'demo@example.com', tenantId: 'demo' });
  });
});

describe('tenant isolation', () => {
  let demo: string;
  let test: string;

  beforeAll(async () => {
    demo = await tokenFor('demo@example.com');
    test = await tokenFor('test@example.com');
  });

  const deviceIds = async (token: string, url = '/api/v1/devices') =>
    (await get(url, token)).json().devices.map((d: { deviceId: string }) => d.deviceId);

  it('lists only the caller’s own devices', async () => {
    expect(await deviceIds(demo)).toEqual(['sim-001', 'sim-002']);
    expect(await deviceIds(test)).toEqual(['test-001']);
  });

  it('lists a registered device that has never reported', async () => {
    const devices = (await get('/api/v1/devices', demo)).json().devices;
    expect(devices.find((d: { deviceId: string }) => d.deviceId === 'sim-002')).toEqual({
      deviceId: 'sim-002',
      lastSeen: null,
      metrics: [],
      latest: {},
    });
  });

  it('ignores a tenantId smuggled into the query string', async () => {
    expect(await deviceIds(test, '/api/v1/devices?tenantId=demo')).toEqual(['test-001']);
  });

  it('serves readings for your own device', async () => {
    const response = await get('/api/v1/devices/test-001/series?metric=temp_c', test);
    expect(response.statusCode).toBe(200);
    expect(response.json().points).toHaveLength(1);
  });

  it('answers 404 for another tenant’s device, exactly as for one that does not exist', async () => {
    const theirs = await get('/api/v1/devices/sim-001/series?metric=temp_c', test);
    const missing = await get('/api/v1/devices/no-such-device/series?metric=temp_c', test);

    expect(theirs.statusCode).toBe(404);
    expect(theirs.json()).toEqual(missing.json());
  });

  it('streams only the caller’s own tenant', async () => {
    const event = (tenantId: string, deviceId: string) =>
      JSON.stringify({
        tenantId,
        deviceId,
        ts: new Date().toISOString(),
        readings: { temp_c: 1 },
      });

    for (let i = 0; i < 50; i++) {
      if ((await publisher.publish('readings:warmup', '{}')) > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const socket = await app.injectWS(`/api/v1/stream?token=${encodeURIComponent(test)}`);
    const received: string[] = [];
    socket.on('message', (data) => received.push(JSON.parse(data.toString()).deviceId));

    await publisher.publish('readings:demo', event('demo', 'sim-001'));
    await publisher.publish('readings:test', event('test', 'test-001'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    socket.terminate();

    expect(received).toEqual(['test-001']);
  });

  it('refuses a stream connection without a token', async () => {
    await expect(app.injectWS('/api/v1/stream')).rejects.toThrow();
  });
});
