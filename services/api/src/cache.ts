import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { DeviceSummary } from './queries.js';

const CachedEvent = z.object({
  deviceId: z.string(),
  ts: z.string(),
  readings: z.record(z.string(), z.number()),
});

export const listDevicesFromCache = async (
  redis: Redis,
  tenantId: string,
): Promise<DeviceSummary[] | null> => {
  const entries = await redis.hgetall(`latest:${tenantId}`);
  const values = Object.values(entries);
  if (values.length === 0) return null;

  const devices: DeviceSummary[] = [];
  for (const raw of values) {
    const parsed = CachedEvent.safeParse(JSON.parse(raw));
    if (!parsed.success) continue;

    devices.push({
      deviceId: parsed.data.deviceId,
      lastSeen: parsed.data.ts,
      metrics: Object.keys(parsed.data.readings).sort(),
      latest: parsed.data.readings,
    });
  }

  return devices.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
};
