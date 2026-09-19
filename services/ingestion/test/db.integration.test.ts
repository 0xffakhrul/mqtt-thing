import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPool, insertReadings } from '../src/db.js';
import type { Reading } from '../src/telemetry.js';

let container: StartedPostgreSqlContainer;
let pool: pg.Pool;

const reading = (overrides: Partial<Reading> = {}): Reading => ({
  tenantId: 'demo',
  deviceId: 'sim-001',
  seq: 1,
  ts: new Date('2026-09-12T04:21:00.000Z'),
  metric: 'temp_c',
  value: 27.3,
  ...overrides,
});

beforeAll(async () => {
  container = await new PostgreSqlContainer('timescale/timescaledb:latest-pg17').start();
  pool = createPool(container.getConnectionUri());

  await pool.query('CREATE EXTENSION IF NOT EXISTS timescaledb');
  await pool.query(`
    CREATE TABLE readings (
      tenant_id text NOT NULL,
      device_id text NOT NULL,
      seq bigint NOT NULL,
      ts timestamptz NOT NULL,
      metric text NOT NULL,
      value double precision NOT NULL
    )`);
  await pool.query(`SELECT create_hypertable('readings', by_range('ts'))`);
  await pool.query(`
    CREATE UNIQUE INDEX readings_dedup_uniq
      ON readings (tenant_id, device_id, seq, metric, ts)`);
}, 120_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

beforeEach(async () => {
  await pool.query('TRUNCATE readings');
});

describe('insertReadings', () => {
  it('inserts one row per metric', async () => {
    const result = await insertReadings(pool, [
      reading({ metric: 'temp_c', value: 27.3 }),
      reading({ metric: 'rh_pct', value: 68 }),
      reading({ metric: 'co2_ppm', value: 812 }),
    ]);

    expect(result).toEqual({ inserted: 3, duplicates: 0 });

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM readings');
    expect(rows[0].n).toBe(3);
  });

  it('silently drops an identical redelivery', async () => {
    const batch = [
      reading({ metric: 'temp_c', value: 27.3 }),
      reading({ metric: 'rh_pct', value: 68 }),
      reading({ metric: 'co2_ppm', value: 812 }),
    ];

    await insertReadings(pool, batch);
    const second = await insertReadings(pool, batch);

    expect(second).toEqual({ inserted: 0, duplicates: 3 });

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM readings');
    expect(rows[0].n).toBe(3);
  });

  it('inserts the non-colliding rows when a batch is partly duplicate', async () => {
    await insertReadings(pool, [reading({ metric: 'temp_c' })]);

    const result = await insertReadings(pool, [
      reading({ metric: 'temp_c' }),
      reading({ metric: 'rh_pct', value: 68 }),
    ]);

    expect(result).toEqual({ inserted: 1, duplicates: 1 });
  });

  it('treats the same seq from a different device as distinct', async () => {
    await insertReadings(pool, [reading({ deviceId: 'sim-001' })]);
    const result = await insertReadings(pool, [reading({ deviceId: 'sim-002' })]);

    expect(result).toEqual({ inserted: 1, duplicates: 0 });
  });

  it('does not dedup a reused seq carrying a new timestamp', async () => {
    await insertReadings(pool, [reading({ seq: 1, ts: new Date('2026-09-12T04:21:00.000Z') })]);
    const result = await insertReadings(pool, [
      reading({ seq: 1, ts: new Date('2026-09-12T05:00:00.000Z') }),
    ]);

    expect(result).toEqual({ inserted: 1, duplicates: 0 });
  });
});
