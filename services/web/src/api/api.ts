import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { type Range, rangeMs } from '../lib/ranges.js';

export const TENANT_ID = 'demo';

export type DeviceSummary = {
  deviceId: string;
  lastSeen: string;
  metrics: string[];
  latest: Record<string, number> | null;
};

type DevicesResponse = {
  source: 'cache' | 'database';
  devices: DeviceSummary[];
};

export type SeriesPoint = {
  bucket: string;
  value: number;
  min: number;
  max: number;
};

export type Series = {
  deviceId: string;
  metric: string;
  from: string;
  to: string;
  bucket: string;
  count: number;
  points: SeriesPoint[];
};

type SeriesArgs = {
  deviceId: string;
  metric: string;
  range: Range;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1' }),
  endpoints: (build) => ({
    getDevices: build.query<DeviceSummary[], void>({
      query: () => ({ url: 'devices', params: { tenantId: TENANT_ID } }),
      transformResponse: (response: DevicesResponse) => response.devices,
    }),
    getSeries: build.query<Series, SeriesArgs>({
      query: ({ deviceId, metric, range }) => {
        const to = new Date();
        const from = new Date(to.getTime() - rangeMs(range));
        return {
          url: `devices/${encodeURIComponent(deviceId)}/series`,
          params: {
            tenantId: TENANT_ID,
            metric,
            from: from.toISOString(),
            to: to.toISOString(),
            maxPoints: 300,
          },
        };
      },
    }),
  }),
});

export const { useGetDevicesQuery, useGetSeriesQuery } = api;
