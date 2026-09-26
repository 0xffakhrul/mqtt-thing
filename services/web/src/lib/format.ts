/** A device is stale once it has missed this many seconds of reports. */
export const STALE_AFTER_SECONDS = 30;

export const secondsSince = (iso: string, now: number = Date.now()): number =>
  Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));

export const formatAge = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
};

export const isStale = (iso: string, now: number = Date.now()): boolean =>
  secondsSince(iso, now) > STALE_AFTER_SECONDS;

const UNITS: Record<string, string> = {
  temp_c: '°C',
  rh_pct: '%',
  co2_ppm: 'ppm',
};

export const unitFor = (metric: string): string => UNITS[metric] ?? '';

export const formatValue = (metric: string, value: number): string =>
  metric === 'co2_ppm' ? value.toFixed(0) : value.toFixed(1);
