import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { latestKeyFor, type ReadingEvent, storeLatest } from '../src/events.js';

let container: StartedRedisContainer;
let redis: Redis;

const event = (ts: string, temp: number): ReadingEvent => ({
  tenantId: 'demo',
  deviceId: 'sim-001',
  ts,
  readings: { temp_c: temp },
});

beforeAll(async () => {
  container = await new RedisContainer('redis:7-alpine').start();
  redis = new Redis(container.getConnectionUrl());
}, 60_000);

afterAll(async () => {
  await redis.quit();
  await container.stop();
});

beforeEach(async () => {
  await redis.del(latestKeyFor('demo'));
});

describe('storeLatest', () => {
  it('stores the first event for a device', async () => {
    expect(await storeLatest(redis, event('2026-09-12T04:21:00.000Z', 27))).toBe(true);
  });

  it('replaces the latest value with a newer event', async () => {
    await storeLatest(redis, event('2026-09-12T04:21:00.000Z', 27));
    expect(await storeLatest(redis, event('2026-09-12T04:21:02.000Z', 28))).toBe(true);

    const stored = JSON.parse((await redis.hget(latestKeyFor('demo'), 'sim-001')) ?? '{}');
    expect(stored.readings.temp_c).toBe(28);
  });

  it('refuses to overwrite with a late, older event', async () => {
    await storeLatest(redis, event('2026-09-12T04:21:02.000Z', 28));
    expect(await storeLatest(redis, event('2026-09-12T04:21:00.000Z', 27))).toBe(false);

    const stored = JSON.parse((await redis.hget(latestKeyFor('demo'), 'sim-001')) ?? '{}');
    expect(stored.readings.temp_c).toBe(28);
  });

  it('ignores an exact redelivery', async () => {
    await storeLatest(redis, event('2026-09-12T04:21:00.000Z', 27));
    expect(await storeLatest(redis, event('2026-09-12T04:21:00.000Z', 27))).toBe(false);
  });
});
