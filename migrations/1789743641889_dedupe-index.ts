import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder): void => {
  pgm.createIndex('readings', ['tenant_id', 'device_id', 'seq', 'metric', 'ts'], {
    name: 'readings_dedupe_uniq',
    unique: true,
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropIndex('readings', ['tenant_id', 'device_id', 'seq', 'metric', 'ts'], {
    name: 'readings_dedupe_uniq',
  });
};
