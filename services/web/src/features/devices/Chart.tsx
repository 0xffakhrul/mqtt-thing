import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '../../api/api.js';
import { formatValue, unitFor } from '../../lib/format.js';

type ChartProps = {
  points: SeriesPoint[];
  metric: string;
  label: string;
};

type Row = {
  t: number;
  value: number;
  band: [number, number];
};

const ACCENT = '#1f5fd1';
const MUTED = '#5a5a55';
const GRID = '#d9d7cf';

const DAY_MS = 24 * 60 * 60 * 1000;

const formatTick = (spanMs: number) => {
  const format = new Intl.DateTimeFormat(
    undefined,
    spanMs > 1.5 * DAY_MS
      ? { month: 'short', day: 'numeric' }
      : { hour: '2-digit', minute: '2-digit', hour12: false },
  );
  return (t: number) => format.format(new Date(t));
};

const ChartTooltip = ({ active, payload, metric }: TooltipContentProps & { metric: string }) => {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || row === undefined) return null;

  return (
    <div className="chart-tooltip">
      <div className="muted">{new Date(row.t).toLocaleString()}</div>
      <div>
        avg {formatValue(metric, row.value)} {unitFor(metric)}
      </div>
      <div className="muted">
        {formatValue(metric, row.band[0])} – {formatValue(metric, row.band[1])}
      </div>
    </div>
  );
};

export const Chart = ({ points, metric, label }: ChartProps) => {
  const rows: Row[] = points.map((p) => ({
    t: new Date(p.bucket).getTime(),
    value: p.value,
    band: [p.min, p.max],
  }));

  const first = rows[0];
  const last = rows[rows.length - 1];
  const span = first !== undefined && last !== undefined ? last.t - first.t : 0;

  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTick(span)}
            tick={{ fill: MUTED, fontSize: 11 }}
            axisLine={{ stroke: '#141414' }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: MUTED, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} metric={metric} />}
            cursor={{ stroke: '#141414', strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            dataKey="band"
            stroke="none"
            fill={ACCENT}
            fillOpacity={0.14}
            isAnimationActive={false}
          />
          <Line
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: ACCENT, stroke: 'none' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
