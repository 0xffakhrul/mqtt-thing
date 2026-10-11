import { createLogger } from '@mqtt-thing/logger';
import pg from 'pg';
import { hashPassword } from './passwords.js';

const logger = createLogger('seed');

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const password = process.env.SEED_PASSWORD ?? 'password';

const tenants = [
  {
    id: 'demo',
    name: 'Demo Farm',
    email: 'demo@example.com',
    devices: ['sim-001'],
  },
  {
    id: 'test',
    name: 'test Farm',
    email: 'test@example.com',
    devices: ['test-001'],
  },
];

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  for (const tenant of tenants) {
    await pool.query(
      `INSERT INTO tenants (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [tenant.id, tenant.name],
    );

    await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [tenant.id, tenant.email, await hashPassword(password)],
    );

    for (const deviceId of tenant.devices) {
      await pool.query(
        `INSERT INTO devices (device_id, tenant_id) VALUES ($1, $2)
         ON CONFLICT (device_id) DO NOTHING`,
        [deviceId, tenant.id],
      );
    }

    logger.info({ tenant: tenant.id, email: tenant.email, devices: tenant.devices }, 'seeded');
  }
} finally {
  await pool.end();
}
