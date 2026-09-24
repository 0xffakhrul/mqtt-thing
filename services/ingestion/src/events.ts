import { Redis } from 'ioredis';
import type { Reading } from './telemetry.js';

export type ReadingEvent = {
  tenantId: string;
  deviceId: string;
  ts: string;
  readings: Record<string, number>;
};

export const channelFor = (tenantId: string): string => `readings:${tenantId}`;

export const createPublisher = (url: string): Redis => new Redis(url, { lazyConnect: false });

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
