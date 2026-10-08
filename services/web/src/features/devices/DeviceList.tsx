import { Link } from 'react-router';
import { type DeviceSummary, useGetDevicesQuery } from '../../api/api.js';
import { describeError } from '../../api/errors.js';
import { formatAge, formatValue, isStale, secondsSince, unitFor } from '../../lib/format.js';
import { useNow } from '../../lib/useNow.js';

const Summary = ({ devices, now }: { devices: DeviceSummary[]; now: number }) => {
  const stale = devices.filter((device) => isStale(device.lastSeen, now)).length;
  const newest = Math.min(...devices.map((device) => secondsSince(device.lastSeen, now)));

  const cells = [
    { label: 'DEVICES', value: String(devices.length) },
    { label: 'ONLINE', value: String(devices.length - stale) },
    { label: 'STALE', value: String(stale) },
    { label: 'LAST READING', value: formatAge(newest) },
  ];

  return (
    <div className="summary">
      {cells.map((cell) => (
        <div key={cell.label} className="summary-cell">
          <div className="label">{cell.label}</div>
          <div className="summary-value">{cell.value}</div>
        </div>
      ))}
    </div>
  );
};

const DeviceCard = ({ device, now }: { device: DeviceSummary; now: number }) => {
  const stale = isStale(device.lastSeen, now);

  return (
    <Link to={`/devices/${device.deviceId}`} className="card">
      <div className="card-header">
        <span className="card-title">{device.deviceId}</span>
        <span className={stale ? 'tag tag-stale' : 'tag tag-live'}>{stale ? 'STALE' : 'LIVE'}</span>
      </div>

      {device.latest === null ? (
        <p className="card-empty muted">No live values yet</p>
      ) : (
        <div className="stats">
          {Object.entries(device.latest).map(([metric, value]) => (
            <div key={metric} className="stat">
              <div className="label">{metric.toUpperCase()}</div>
              <div className={stale ? 'stat-value dim' : 'stat-value'}>
                {formatValue(metric, value)}
                <span className="unit">{unitFor(metric)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-footer">
        <span>last seen {formatAge(secondsSince(device.lastSeen, now))}</span>
        <span className="ink">open →</span>
      </div>
    </Link>
  );
};

export const DeviceList = () => {
  const now = useNow();
  const {
    data: devices,
    error,
    isLoading,
  } = useGetDevicesQuery(undefined, {
    pollingInterval: 60_000,
    refetchOnFocus: true,
  });

  if (isLoading) return <p className="muted">Loading devices…</p>;
  if (error) return <p className="error">Could not load devices: {describeError(error)}</p>;
  if (devices === undefined || devices.length === 0) {
    return <p className="muted">No devices have reported yet. Is the simulator running?</p>;
  }

  return (
    <>
      <Summary devices={devices} now={now} />
      <div className="card-grid">
        {devices.map((device) => (
          <DeviceCard key={device.deviceId} device={device} now={now} />
        ))}
      </div>
    </>
  );
};
