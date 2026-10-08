import { describe, expect, it } from 'vitest';
import { backoffMs, parseEvent } from '../src/api/stream.js';

describe('backoffMs', () => {
  it('doubles from one second', () => {
    expect([0, 1, 2, 3, 4].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it('caps at thirty seconds', () => {
    expect(backoffMs(5)).toBe(30_000);
    expect(backoffMs(20)).toBe(30_000);
  });
});

describe('parseEvent', () => {
  const valid = {
    tenantId: 'demo',
    deviceId: 'sim-001',
    ts: '2026-09-12T04:21:00.000Z',
    readings: { temp_c: 27.3 },
  };

  it('accepts a well-formed event', () => {
    expect(parseEvent(JSON.stringify(valid))).toEqual(valid);
  });

  it.each([
    ['binary frame', new ArrayBuffer(4)],
    ['not JSON', 'hello'],
    ['JSON null', 'null'],
    ['missing deviceId', JSON.stringify({ ...valid, deviceId: undefined })],
    ['readings not an object', JSON.stringify({ ...valid, readings: 'hot' })],
  ])('rejects %s', (_label, raw) => {
    expect(parseEvent(raw)).toBeNull();
  });
});
