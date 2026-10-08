export type ReadingEvent = {
  tenantId: string;
  deviceId: string;
  ts: string;
  readings: Record<string, number>;
};

export type StreamStatus = 'connecting' | 'open' | 'reconnecting';

export type StreamState = {
  status: StreamStatus;
  recent: ReadingEvent[];
};

export const RECENT_LIMIT = 20;

export const streamUrl = (tenantId: string): string => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/api/v1/stream?tenantId=${encodeURIComponent(tenantId)}`;
};

export const parseEvent = (raw: unknown): ReadingEvent | null => {
  if (typeof raw !== 'string') return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof data !== 'object' || data === null) return null;
  const event = data as Partial<ReadingEvent>;

  if (
    typeof event.tenantId !== 'string' ||
    typeof event.deviceId !== 'string' ||
    typeof event.ts !== 'string' ||
    typeof event.readings !== 'object' ||
    event.readings === null
  ) {
    return null;
  }

  return event as ReadingEvent;
};

export const backoffMs = (attempt: number): number => Math.min(30_000, 1000 * 2 ** attempt);
