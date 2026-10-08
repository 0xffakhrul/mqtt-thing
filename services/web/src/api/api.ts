import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { type Range, rangeMs } from '../lib/ranges.js';
import { backoffMs, parseEvent, RECENT_LIMIT, type StreamState, streamUrl } from './stream.js';

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

    getStream: build.query<StreamState, void>({
      queryFn: () => ({ data: { status: 'connecting', recent: [] } }),

      async onCacheEntryAdded(
        _arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch },
      ) {
        await cacheDataLoaded;

        const conn: {
          socket: WebSocket | null;
          retry?: ReturnType<typeof setTimeout>;
        } = {
          socket: null,
        };
        let attempt = 0;
        let removed = false;

        const connect = () => {
          const socket = new WebSocket(streamUrl(TENANT_ID));
          conn.socket = socket;

          socket.onopen = () => {
            attempt = 0;
            updateCachedData((draft) => {
              draft.status = 'open';
            });
          };

          socket.onmessage = (message) => {
            const event = parseEvent(message.data);
            if (event === null) return;

            updateCachedData((draft) => {
              draft.recent.unshift(event);
              draft.recent.splice(RECENT_LIMIT);
            });

            dispatch(
              api.util.updateQueryData('getDevices', undefined, (devices) => {
                const device = devices.find((d) => d.deviceId === event.deviceId);
                if (device === undefined) {
                  devices.push({
                    deviceId: event.deviceId,
                    lastSeen: event.ts,
                    metrics: Object.keys(event.readings).sort(),
                    latest: event.readings,
                  });
                  return;
                }
                if (event.ts < device.lastSeen) return;
                device.lastSeen = event.ts;
                device.latest = event.readings;
              }),
            );
          };

          socket.onclose = () => {
            if (removed) return;
            updateCachedData((draft) => {
              draft.status = 'reconnecting';
            });
            conn.retry = setTimeout(connect, backoffMs(attempt));
            attempt += 1;
          };
        };

        connect();

        await cacheEntryRemoved;
        removed = true;
        clearTimeout(conn.retry);
        conn.socket?.close();
      },
    }),
  }),
});

export const { useGetDevicesQuery, useGetSeriesQuery, useGetStreamQuery } = api;
