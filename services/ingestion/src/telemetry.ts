import { z } from 'zod';

export type Reading = {
  tenantId: string;
  deviceId: string;
  seq: number;
  ts: Date;
  metric: string;
  value: number;
};

export type ParseResult = { ok: true; readings: Reading[] } | { ok: false; reason: string };

const TELEMETRY_TOPIC = /^v1\/([^/]+)\/devices\/([^/]+)\/telemetry$/;

export const TelemetrySchema = z.object({
  seq: z.number().int().nonnegative(),
  ts: z.iso.datetime({ offset: true }),
  readings: z
    .record(z.string().min(1), z.number())
    .refine((readings) => Object.keys(readings).length > 0, {
      message: 'must contain at least one reading',
    }),
});

export type Telemetry = z.infer<typeof TelemetrySchema>;

export const parseTopic = (topic: string): { tenantId: string; deviceId: string } | null => {
  const match = TELEMETRY_TOPIC.exec(topic);
  if (match === null) return null;

  const [, tenantId, deviceId] = match;
  if (tenantId === undefined || deviceId === undefined) return null;

  return { tenantId, deviceId };
};

const formatIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    })
    .join('; ');

export const parseTelemetry = (topic: string, payload: string): ParseResult => {
  const route = parseTopic(topic);
  if (route === null) {
    return {
      ok: false,
      reason: 'topic does not match v1/{tenantId}/devices/{deviceId}/telemetry',
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return { ok: false, reason: 'payload is not valid JSON' };
  }

  const parsed = TelemetrySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, reason: formatIssues(parsed.error) };
  }

  const ts = new Date(parsed.data.ts);

  return {
    ok: true,
    readings: Object.entries(parsed.data.readings).map(([metric, value]) => ({
      ...route,
      seq: parsed.data.seq,
      ts,
      metric,
      value,
    })),
  };
};
