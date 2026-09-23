import { describe, expect, it } from 'vitest';
import { bucketFor } from '../src/downsample.js';

describe('bucketFor', () => {
  const from = new Date('2026-09-12T00:00:00.000Z');

  it('keeps one-second resolution when the range is small enough', () => {
    const to = new Date('2026-09-12T00:01:00.000Z');
    expect(bucketFor(from, to, 500)).toBe('1 seconds');
  });

  it('widens the bucket so a long range stays under maxPoints', () => {
    const to = new Date('2026-09-13T00:00:00.000Z');
    expect(bucketFor(from, to, 500)).toBe('173 seconds');
  });

  it('respects a smaller maxPoints for constrained clients', () => {
    const to = new Date('2026-09-13T00:00:00.000Z');
    expect(bucketFor(from, to, 100)).toBe('864 seconds');
  });

  it('never returns a zero-width bucket', () => {
    const to = new Date('2026-09-12T00:00:00.500Z');
    expect(bucketFor(from, to, 5000)).toBe('1 seconds');
  });
});
