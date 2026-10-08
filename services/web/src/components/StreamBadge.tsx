import { useGetStreamQuery } from '../api/api.js';

const LABELS = {
  connecting: 'CONNECTING',
  open: 'STREAM LIVE',
  reconnecting: 'RECONNECTING',
} as const;

export const StreamBadge = () => {
  const { data } = useGetStreamQuery();
  const status = data?.status ?? 'connecting';

  return (
    <span className={status === 'open' ? 'badge badge-live' : 'badge badge-waiting'} role="status">
      <span className="badge-dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
};
