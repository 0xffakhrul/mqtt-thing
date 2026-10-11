import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REDIS_OPTIONS } from '../src/events.js';

let container: StartedRedisContainer;
let redis: Redis;
let admin: Redis;

beforeAll(async () => {
  container = await new RedisContainer('redis:7-alpine').start();
  redis = new Redis(container.getConnectionUrl(), REDIS_OPTIONS);
  admin = new Redis(container.getConnectionUrl());
  await new Promise((resolve) => redis.once('ready', resolve));
}, 60_000);

afterAll(async () => {
  redis.disconnect();
  admin.disconnect();
  await container.stop();
});

describe('when redis stops answering', () => {
  it('fails fast instead of holding the publish, then recovers', async () => {
    await admin.call('CLIENT', 'PAUSE', '2500', 'ALL');

    const started = Date.now();
    await expect(redis.publish('readings:demo', '{}')).rejects.toThrow(/timed out/);
    expect(Date.now() - started).toBeLessThan(2_000);

    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await expect(redis.publish('readings:demo', '{}')).resolves.toBe(0);
  }, 10_000);
});
