import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder): void => {
  pgm.createTable('latest_readings', {
    tenant_id: { type: 'text', notNull: true },
    device_id: { type: 'text', notNull: true },
    metric: { type: 'text', notNull: true },
    ts: { type: 'timestamptz', notNull: true },
    value: { type: 'double precision', notNull: true },
  });

  pgm.addConstraint('latest_readings', 'latest_readings_pkey', {
    primaryKey: ['tenant_id', 'device_id', 'metric'],
  });

  pgm.sql(`
    INSERT INTO latest_readings (tenant_id, device_id, metric, ts, value)
    SELECT DISTINCT ON (tenant_id, device_id, metric)
           tenant_id, device_id, metric, ts, value
      FROM readings
     ORDER BY tenant_id, device_id, metric, ts DESC
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('latest_readings');
};
