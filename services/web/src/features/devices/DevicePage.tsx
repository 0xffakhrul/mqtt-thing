import { Link, useParams, useSearchParams } from 'react-router';
import { useGetDevicesQuery, useGetSeriesQuery } from '../../api/api.js';
import { describeError } from '../../api/errors.js';
import { SegmentedControl } from '../../components/SegmentedControl.js';
import { formatAge, formatValue, isStale, secondsSince, unitFor } from '../../lib/format.js';
import { isRange, RANGES } from '../../lib/ranges.js';
import { useNow } from '../../lib/useNow.js';
import { Chart } from './Chart.js';
import { RecentReadings } from './RecentReadings.js';

export const DevicePage = () => {
  const { deviceId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const now = useNow();

  // The URL is the state: each device keeps its own choice, and links are shareable.
  const metric = params.get('metric') ?? 'temp_c';
  const rangeParam = params.get('range');
  const range = isRange(rangeParam) ? rangeParam : '1h';

  const select = (key: 'metric' | 'range', value: string) =>
    setParams(
      (prev) => {
        prev.set(key, value);
        return prev;
      },
      { replace: true },
    );

  // Reuses the list query's cache entry: no extra request if you came from the list.
  const { device, isLoading: devicesLoading } = useGetDevicesQuery(undefined, {
    pollingInterval: 60_000,
    selectFromResult: ({ data, isLoading }) => ({
      device: data?.find((d) => d.deviceId === deviceId),
      isLoading,
    }),
  });

  const {
    data: series,
    error: seriesError,
    isFetching,
  } = useGetSeriesQuery({ deviceId, metric, range }, { pollingInterval: 30_000 });

  if (devicesLoading) return <p className="muted">Loading device…</p>;
  if (device === undefined) {
    return (
      <p className="muted">
        No device called {deviceId}. <Link to="/">Back to devices</Link>
      </p>
    );
  }

  const stale = isStale(device.lastSeen, now);
  const metrics = device.metrics.length > 0 ? device.metrics : [metric];
  const points = series?.points ?? [];
  const lows = points.map((p) => p.min);
  const highs = points.map((p) => p.max);

  return (
    <>
      <div className="page-heading">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/">devices</Link> / {device.deviceId}
        </nav>
        <div className="title-row">
          <div className="title-group">
            <h1>{device.deviceId}</h1>
            <span className={stale ? 'tag tag-stale' : 'tag tag-live'}>
              {stale ? 'STALE' : 'LIVE'}
            </span>
          </div>
          <span className="muted meta">
            {device.metrics.length} metrics · last seen{' '}
            {formatAge(secondsSince(device.lastSeen, now))}
          </span>
        </div>
      </div>

      {device.lastSeen !== null && (
        <div className="stats stats-strip">
          {Object.entries(device.latest).map(([name, value]) => (
            <div key={name} className="stat">
              <div className="label">{name.toUpperCase()}</div>
              <div className={stale ? 'stat-value stat-value-lg dim' : 'stat-value stat-value-lg'}>
                {formatValue(name, value)}
                <span className="unit">{unitFor(name)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-toolbar">
            <SegmentedControl
              label="Metric"
              options={metrics}
              value={metric}
              onChange={(next) => select('metric', next)}
            />
            <SegmentedControl
              label="Time range"
              options={RANGES}
              value={range}
              onChange={(next) => select('range', next)}
            />
          </div>

          <div className="panel-meta">
            <span>
              {series === undefined
                ? '—'
                : `${series.bucket.replace(' seconds', ' s')} buckets · ${series.count} points`}
              {isFetching && ' · updating'}
            </span>
            <span className="legend">
              <span className="legend-line" /> avg <span className="legend-band" /> min–max
            </span>
          </div>

          <div className="chart-frame">
            {seriesError !== undefined ? (
              <p className="error chart-message">
                Could not load readings: {describeError(seriesError)}
              </p>
            ) : points.length === 0 ? (
              <p className="muted chart-message">
                {series === undefined ? 'Loading readings…' : 'No readings in this range.'}
              </p>
            ) : (
              <Chart
                points={points}
                metric={metric}
                label={`${metric} over the last ${range}, average with min–max band`}
              />
            )}
          </div>

          {points.length > 0 && (
            <div className="panel-footer muted">
              {range} min {formatValue(metric, Math.min(...lows))} · max{' '}
              {formatValue(metric, Math.max(...highs))} {unitFor(metric)}
            </div>
          )}
        </section>

        <RecentReadings deviceId={device.deviceId} />
      </div>
    </>
  );
};
