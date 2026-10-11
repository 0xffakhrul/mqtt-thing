import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder): void => {
  pgm.createTable('tenants', {
    id: { type: 'text', primaryKey: true },
    name: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tenant_id: {
      type: 'text',
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE',
    },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('devices', {
    device_id: { type: 'text', primaryKey: true },
    tenant_id: {
      type: 'text',
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE',
    },
    name: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('devices', 'tenant_id');

  pgm.sql(`
    INSERT INTO tenants (id, name)
    SELECT DISTINCT tenant_id, tenant_id FROM latest_readings
    ON CONFLICT DO NOTHING
  `);
  pgm.sql(`
    INSERT INTO devices (device_id, tenant_id)
    SELECT DISTINCT ON (device_id) device_id, tenant_id
      FROM latest_readings
     ORDER BY device_id
    ON CONFLICT DO NOTHING
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('devices');
  pgm.dropTable('users');
  pgm.dropTable('tenants');
};
