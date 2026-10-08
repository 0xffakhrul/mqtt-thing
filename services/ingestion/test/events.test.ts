import { describe, expect, it } from 'vitest';
import { channelFor, createThrottle, toEvent } from '../src/events.js';
import type { Reading } from '../src/telemetry.js';

const reading = (metric: string, value: number): Reading => ({
  tenantId: 'demo',
  deviceId: 'sim-001',
  seq: 42,
  ts: new Date('2026-09-12T04:21:00.000Z'),
  metric,
  value,
});

describe('toEvent', () => {
  it('collapses per-metric rows back into one event', () => {
    expect(toEvent([reading('temp_c', 27.3), reading('rh_pct', 68)])).toEqual({
      tenantId: 'demo',
      deviceId: 'sim-001',
      ts: '2026-09-12T04:21:00.000Z',
      readings: { temp_c: 27.3, rh_pct: 68 },
    });
  });

  it('returns null for an empty batch', () => {
    expect(toEvent([])).toBeNull();
  });
});

describe('channelFor', () => {
  it('namespaces the channel by tenant', () => {
    expect(channelFor('demo')).toBe('readings:demo');
  });
});

describe('createThrottle', () => {
  it('opens once, then stays shut until the interval has passed', () => {
    const allow = createThrottle(30_000);
    expect(allow(0)).toBe(true);
    expect(allow(1_000)).toBe(false);
    expect(allow(29_999)).toBe(false);
    expect(allow(30_000)).toBe(true);
    expect(allow(30_001)).toBe(false);
  });
});
