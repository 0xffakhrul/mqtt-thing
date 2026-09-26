export const RANGES = ['15m', '1h', '6h', '24h', '7d'] as const;
export type Range = (typeof RANGES)[number];

const RANGE_MS: Record<Range, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export const rangeMs = (range: Range): number => RANGE_MS[range];
