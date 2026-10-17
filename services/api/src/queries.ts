import type pg from 'pg';

export type Bucket = {
  bucket: string;
  value: number;
  min: number;
  max: number;
};

export type DeviceSummary = {
  deviceId: string;
  lastSeen: string | null;
  metrics: string[];
  latest: Record<string, number>;
};

export const listDevices = async (pool: pg.Pool, tenantId: string): Promise<DeviceSummary[]> => {
  const { rows } = await pool.query<{
    device_id: string;
    last_seen: Date | null;
    metrics: string[];
    latest: Record<string, number>;
  }>(
    `SELECT d.device_id,
            max(l.ts) AS last_seen,
            coalesce(array_agg(l.metric ORDER BY l.metric) FILTER (WHERE l.metric IS NOT NULL), '{}')
              AS metrics,
            coalesce(jsonb_object_agg(l.metric, l.value) FILTER (WHERE l.metric IS NOT NULL), '{}')
              AS latest
       FROM devices d
       LEFT JOIN latest_readings l
              ON l.tenant_id = d.tenant_id
             AND l.device_id = d.device_id
      WHERE d.tenant_id = $1
      GROUP BY d.device_id
      ORDER BY d.device_id`,
    [tenantId],
  );

  return rows.map((row) => ({
    deviceId: row.device_id,
    lastSeen: row.last_seen === null ? null : row.last_seen.toISOString(),
    metrics: row.metrics,
    latest: row.latest,
  }));
};

export const deviceExists = async (
  pool: pg.Pool,
  tenantId: string,
  deviceId: string,
): Promise<boolean> => {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM devices WHERE tenant_id = $1 AND device_id = $2',
    [tenantId, deviceId],
  );
  return (rowCount ?? 0) > 0;
};

export const readSeries = async (
  pool: pg.Pool,
  params: {
    tenantId: string;
    deviceId: string;
    metric: string;
    from: Date;
    to: Date;
    bucket: string;
  },
): Promise<Bucket[]> => {
  const { rows } = await pool.query<{
    bucket: Date;
    value: string;
    min: string;
    max: string;
  }>(
    `SELECT time_bucket($6::interval, ts) AS bucket,
            avg(value)                    AS value,
            min(value)                    AS min,
            max(value)                    AS max
       FROM readings
      WHERE tenant_id = $1
        AND device_id = $2
        AND metric    = $3
        AND ts >= $4
        AND ts <  $5
      GROUP BY bucket
      ORDER BY bucket`,
    [params.tenantId, params.deviceId, params.metric, params.from, params.to, params.bucket],
  );

  return rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    value: Number(row.value),
    min: Number(row.min),
    max: Number(row.max),
  }));
};
