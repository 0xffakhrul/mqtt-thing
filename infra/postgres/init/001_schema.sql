CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS readings (
  tenant_id  text             NOT NULL,
  device_id  text             NOT NULL,
  seq        bigint           NOT NULL,
  ts         timestamptz      NOT NULL,
  metric     text             NOT NULL,
  value      double precision NOT NULL
);

SELECT create_hypertable('readings', by_range('ts'), if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS readings_tenant_device_ts_idx
  ON readings (tenant_id, device_id, ts DESC);