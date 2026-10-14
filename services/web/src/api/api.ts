import type { Dispatch } from '@reduxjs/toolkit';
import {
  type BaseQueryFn,
  createApi,
  type FetchArgs,
  type FetchBaseQueryError,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import { type AuthRoot, loggedOut, selectSession } from '../features/auth/authSlice.js';
import { type Range, rangeMs } from '../lib/ranges.js';
import { backoffMs, parseEvent, RECENT_LIMIT, type StreamState, streamUrl } from './stream.js';

export type DeviceSummary = {
  deviceId: string;
  lastSeen: string;
  metrics: string[];
  latest: Record<string, number>;
};

type DevicesResponse = {
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

type LoginArgs = { email: string; password: string };
type LoginResponse = {
  token: string;
  user: { email: string; tenantId: string };
};

const tokenFrom = (state: unknown): string | undefined => selectSession(state as AuthRoot)?.token;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers, { getState }) => {
    const token = tokenFrom(getState());
    if (token !== undefined) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

export const logOut = (dispatch: Dispatch): void => {
  dispatch(api.util.resetApiState());
  dispatch(loggedOut());
};

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  context,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, context, extraOptions);
  if (result.error?.status === 401 && tokenFrom(context.getState()) !== undefined) {
    logOut(context.dispatch);
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginArgs>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
    }),

    getDevices: build.query<DeviceSummary[], void>({
      query: () => 'devices',
      transformResponse: (response: DevicesResponse) => response.devices,
    }),

    getSeries: build.query<Series, SeriesArgs>({
      query: ({ deviceId, metric, range }) => {
        const to = new Date();
        const from = new Date(to.getTime() - rangeMs(range));
        return {
          url: `devices/${encodeURIComponent(deviceId)}/series`,
          params: {
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
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch, getState },
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
          // Read the token on every (re)connect, never once up front.
          const token = tokenFrom(getState());
          if (token === undefined) return;

          const socket = new WebSocket(streamUrl(token));
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

export const { useLoginMutation, useGetDevicesQuery, useGetSeriesQuery, useGetStreamQuery } = api;
