import pg from 'pg';
import type { Reading } from './telemetry.js';

const { Pool } = pg;

export const createPool = (connectionString: string): pg.Pool => new Pool({ connectionString });
export type InsertResult = { inserted: number; duplicates: number };

export const insertReadings = async (pool: pg.Pool, readings: Reading[]): Promise<InsertResult> => {
  if (readings.length === 0) return { inserted: 0, duplicates: 0 };

  const result = await pool.query(
    `INSERT INTO readings (tenant_id, device_id, seq, ts, metric, value)
     SELECT * FROM unnest(
       $1::text[], $2::text[], $3::bigint[], $4::timestamptz[], $5::text[], $6::double precision[]
     )
     ON CONFLICT DO NOTHING`,
    [
      readings.map((r) => r.tenantId),
      readings.map((r) => r.deviceId),
      readings.map((r) => r.seq),
      readings.map((r) => r.ts.toISOString()),
      readings.map((r) => r.metric),
      readings.map((r) => r.value),
    ],
  );

  const inserted = result.rowCount ?? 0;
  return { inserted, duplicates: readings.length - inserted };
};
