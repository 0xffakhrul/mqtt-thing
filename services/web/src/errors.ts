import type { SerializedError } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

/**
 * RTK Query errors are a union: an HTTP/network failure from fetchBaseQuery,
 * or a serialized JS error thrown elsewhere. Flatten both to something printable.
 */
export const describeError = (error: FetchBaseQueryError | SerializedError): string => {
  if ('status' in error) {
    return typeof error.status === 'number' ? `HTTP ${error.status}` : error.error;
  }
  return error.message ?? 'Unknown error';
};
