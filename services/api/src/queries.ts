import type pg from 'pg';

export type DeviceSummary = {
  deviceId: string;
  lastSeen: string;
  metrics: string[];
  latest: Record<string, number> | null;
};

export type Bucket = {
  bucket: string;
  value: number;
  min: number;
  max: number;
};

export const listDevices = async (pool: pg.Pool, tenantId: string): Promise<DeviceSummary[]> => {
  const { rows } = await pool.query<{
    device_id: string;
    last_seen: Date;
    metrics: string[];
  }>(
    `SELECT device_id,
            max(ts)                     AS last_seen,
            array_agg(DISTINCT metric)  AS metrics
       FROM readings
      WHERE tenant_id = $1
      GROUP BY device_id
      ORDER BY device_id`,
    [tenantId],
  );

  return rows.map((row) => ({
    deviceId: row.device_id,
    lastSeen: row.last_seen.toISOString(),
    metrics: row.metrics,
    latest: null,
  }));
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
