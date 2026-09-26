import { Link, useParams } from 'react-router';
import { useGetDevicesQuery, useGetSeriesQuery } from '../../api/api.js';
import { describeError } from '../../api/errors.js';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { SegmentedControl } from '../../components/SegmentedControl.js';
import { formatAge, formatValue, isStale, secondsSince, unitFor } from '../../lib/format.js';
import { RANGES } from '../../lib/ranges.js';
import { Chart } from './Chart.js';
import { metricSelected, rangeSelected } from './viewSlice.js';

export const DevicePage = () => {
  const { deviceId = '' } = useParams();
  const dispatch = useAppDispatch();
  const { metric, range } = useAppSelector((state) => state.view);

  // Reuses the list query's cache entry: no extra request if you came from the list.
  const { device, isLoading: devicesLoading } = useGetDevicesQuery(undefined, {
    pollingInterval: 10_000,
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

  const stale = isStale(device.lastSeen);
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
            {device.metrics.length} metrics · last seen {formatAge(secondsSince(device.lastSeen))}
          </span>
        </div>
      </div>

      {device.latest !== null && (
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

      <section className="panel">
        <div className="panel-toolbar">
          <SegmentedControl
            label="Metric"
            options={metrics}
            value={metric}
            onChange={(next) => dispatch(metricSelected(next))}
          />
          <SegmentedControl
            label="Time range"
            options={RANGES}
            value={range}
            onChange={(next) => dispatch(rangeSelected(next))}
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
    </>
  );
};
