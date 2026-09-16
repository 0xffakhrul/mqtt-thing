import { describe, expect, it } from 'vitest';
import { parseTelemetry, parseTopic } from '../src/telemetry.js';

describe('parseTopic', () => {
  it('extracts tenant and device from a valid telemetry topic', () => {
    expect(parseTopic('v1/demo/devices/sim-001/telemetry')).toEqual({
      tenantId: 'demo',
      deviceId: 'sim-001',
    });
  });

  it('rejects topics from another version or channel', () => {
    expect(parseTopic('v2/demo/devices/sim-001/telemetry')).toBeNull();
    expect(parseTopic('v1/demo/devices/sim-001/status')).toBeNull();
    expect(parseTopic('v1/demo/devices/sim-001/telemetry/extra')).toBeNull();
  });
});

describe('parseTelemetry', () => {
  const topic = 'v1/demo/devices/sim-001/telemetry';

  it('flattens a readings object into one row per metric', () => {
    const result = parseTelemetry(
      topic,
      JSON.stringify({
        seq: 42,
        ts: '2026-09-12T04:21:00.000Z',
        readings: { temp_c: 27.3, rh_pct: 68 },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.readings).toHaveLength(2);
    expect(result.readings[0]).toMatchObject({
      tenantId: 'demo',
      deviceId: 'sim-001',
      seq: 42,
      metric: 'temp_c',
      value: 27.3,
    });
  });

  it.each([
    ['not json at all', 'payload is not valid JSON'],
    [JSON.stringify([1, 2, 3]), 'payload is not a JSON object'],
    [JSON.stringify({ ts: '2026-09-12T04:21:00.000Z', readings: { t: 1 } }), 'seq'],
    [JSON.stringify({ seq: 1, ts: 'yesterday', readings: { t: 1 } }), 'ts'],
    [JSON.stringify({ seq: 1, ts: '2026-09-12T04:21:00.000Z', readings: {} }), 'empty'],
    [
      JSON.stringify({
        seq: 1,
        ts: '2026-09-12T04:21:00.000Z',
        readings: { t: 'hot' },
      }),
      'finite',
    ],
  ])('rejects malformed payload %#', (payload, expected) => {
    const result = parseTelemetry(topic, payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain(expected);
  });
});
