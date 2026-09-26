import { type DeviceSummary, useGetDevicesQuery } from './api.js';
import { describeError } from './errors.js';
import { formatAge, formatValue, isStale, secondsSince, unitFor } from './format.js';

const Summary = ({ devices }: { devices: DeviceSummary[] }) => {
  const now = Date.now();
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

const DeviceCard = ({ device }: { device: DeviceSummary }) => {
  const stale = isStale(device.lastSeen);

  return (
    <a href={`/devices/${device.deviceId}`} className="card">
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
        <span>last seen {formatAge(secondsSince(device.lastSeen))}</span>
        <span className="ink">open →</span>
      </div>
    </a>
  );
};

export const DeviceList = () => {
  const {
    data: devices,
    error,
    isLoading,
  } = useGetDevicesQuery(undefined, {
    pollingInterval: 10_000,
    refetchOnFocus: true,
  });

  if (isLoading) return <p className="muted">Loading devices…</p>;
  if (error) return <p className="error">Could not load devices: {describeError(error)}</p>;
  if (devices === undefined || devices.length === 0) {
    return <p className="muted">No devices have reported yet. Is the simulator running?</p>;
  }

  return (
    <>
      <Summary devices={devices} />
      <div className="card-grid">
        {devices.map((device) => (
          <DeviceCard key={device.deviceId} device={device} />
        ))}
      </div>
    </>
  );
};
