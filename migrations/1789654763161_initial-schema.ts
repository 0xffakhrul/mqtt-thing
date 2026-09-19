import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder): void => {
  pgm.createExtension('timescaledb', { ifNotExists: true });

  pgm.createTable('readings', {
    tenant_id: { type: 'text', notNull: true },
    device_id: { type: 'text', notNull: true },
    seq: { type: 'bigint', notNull: true },
    ts: { type: 'timestamptz', notNull: true },
    metric: { type: 'text', notNull: true },
    value: { type: 'double precision', notNull: true },
  });

  pgm.sql(`SELECT create_hypertable('readings', by_range('ts'))`);

  pgm.createIndex('readings', ['tenant_id', 'device_id', { name: 'ts', sort: 'DESC' }], {
    name: 'readings_tenant_device_ts_idx',
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('readings');
};
