import { Redis } from 'ioredis';
import type { Reading } from './telemetry.js';

export type ReadingEvent = {
  tenantId: string;
  deviceId: string;
  ts: string;
  readings: Record<string, number>;
};

export const channelFor = (tenantId: string): string => `readings:${tenantId}`;

export const REDIS_OPTIONS = {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 1_000,
} as const;

export const createPublisher = (url: string): Redis => new Redis(url, REDIS_OPTIONS);

export const toEvent = (readings: Reading[]): ReadingEvent | null => {
  const first = readings[0];
  if (first === undefined) return null;

  const values: Record<string, number> = {};
  for (const reading of readings) {
    values[reading.metric] = reading.value;
  }

  return {
    tenantId: first.tenantId,
    deviceId: first.deviceId,
    ts: first.ts.toISOString(),
    readings: values,
  };
};

export const latestKeyFor = (tenantId: string): string => `latest:${tenantId}`;

const SET_IF_NEWER = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
if current then
  local currentTs = cjson.decode(current)['ts']
  if currentTs >= ARGV[2] then
    return 0
  end
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
return 1
`;

export const storeLatest = async (redis: Redis, event: ReadingEvent): Promise<boolean> => {
  const updated = await redis.eval(
    SET_IF_NEWER,
    1,
    latestKeyFor(event.tenantId),
    event.deviceId,
    event.ts,
    JSON.stringify(event),
  );
  return updated === 1;
};

export const createThrottle = (intervalMs: number) => {
  let last = Number.NEGATIVE_INFINITY;
  return (now: number = Date.now()): boolean => {
    if (now - last < intervalMs) return false;
    last = now;
    return true;
  };
};
