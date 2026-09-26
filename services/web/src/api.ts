import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

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

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1' }),
  endpoints: (build) => ({
    getDevices: build.query<DeviceSummary[], void>({
      query: () => ({ url: 'devices', params: { tenantId: TENANT_ID } }),
      transformResponse: (response: DevicesResponse) => response.devices,
    }),
  }),
});

export const { useGetDevicesQuery } = api;
