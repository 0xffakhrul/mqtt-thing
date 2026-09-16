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

export const parseTopic = (topic: string): { tenantId: string; deviceId: string } | null => {
  const match = TELEMETRY_TOPIC.exec(topic);
  if (match === null) return null;

  const [, tenantId, deviceId] = match;
  if (tenantId === undefined || deviceId === undefined) return null;

  return { tenantId, deviceId };
};

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

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, reason: 'payload is not a JSON object' };
  }

  const { seq, ts, readings } = body as Record<string, unknown>;

  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) {
    return { ok: false, reason: 'seq must be a non-negative integer' };
  }

  if (typeof ts !== 'string') {
    return { ok: false, reason: 'ts must be an ISO 8601 string' };
  }

  const timestamp = new Date(ts);
  if (Number.isNaN(timestamp.getTime())) {
    return { ok: false, reason: 'ts is not a parseable timestamp' };
  }

  if (typeof readings !== 'object' || readings === null || Array.isArray(readings)) {
    return {
      ok: false,
      reason: 'readings must be an object of metric -> number',
    };
  }

  const rows: Reading[] = [];
  for (const [metric, value] of Object.entries(readings)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return {
        ok: false,
        reason: `reading "${metric}" is not a finite number`,
      };
    }
    rows.push({ ...route, seq, ts: timestamp, metric, value });
  }

  if (rows.length === 0) {
    return { ok: false, reason: 'readings object is empty' };
  }

  return { ok: true, readings: rows };
};
