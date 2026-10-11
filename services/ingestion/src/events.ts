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

export const createThrottle = (intervalMs: number) => {
  let last = Number.NEGATIVE_INFINITY;
  return (now: number = Date.now()): boolean => {
    if (now - last < intervalMs) return false;
    last = now;
    return true;
  };
};
