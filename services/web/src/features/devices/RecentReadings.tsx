import { useGetStreamQuery } from '../../api/api.js';
import { formatValue } from '../../lib/format.js';

const METRICS = ['temp_c', 'rh_pct', 'co2_ppm'] as const;

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

type RecentReadingsProps = {
  deviceId?: string;
  limit?: number;
};

export const RecentReadings = ({ deviceId, limit = 10 }: RecentReadingsProps) => {
  const { data } = useGetStreamQuery();

  const events = (data?.recent ?? [])
    .filter((event) => deviceId === undefined || event.deviceId === deviceId)
    .slice(0, limit);

  const showDevice = deviceId === undefined;
  const title = showDevice ? 'RECENT READINGS' : 'LIVE STREAM';

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span className="muted">newest first · pushed, not polled</span>
      </div>

      {events.length === 0 ? (
        <p className="muted readings-empty">Waiting for the next reading…</p>
      ) : (
        <table className="readings-table">
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="col-time">
                TIME
              </th>
              {showDevice && (
                <th scope="col" className="col-device">
                  DEVICE
                </th>
              )}
              {METRICS.map((metric) => (
                <th key={metric} scope="col">
                  {metric.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr
                key={`${event.deviceId}-${event.ts}`}
                className={index === 0 ? 'readings-newest' : undefined}
              >
                <td className="muted">{timeFormat.format(new Date(event.ts))}</td>
                {showDevice && <td className="strong">{event.deviceId}</td>}
                {METRICS.map((metric) => {
                  const value = event.readings[metric];
                  return (
                    <td key={metric}>{value === undefined ? '—' : formatValue(metric, value)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
