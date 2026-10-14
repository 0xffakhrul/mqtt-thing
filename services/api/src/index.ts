import { createLogger } from '@mqtt-thing/logger';
import pg from 'pg';
import { buildApp } from './app.js';
import { config } from './config.js';

const logger = createLogger('api');
const pool = new pg.Pool({ connectionString: config.databaseUrl });

const app = await buildApp({
  pool,
  redisUrl: config.redisUrl,
  jwtSecret: config.jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
  logger,
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
  } catch (error) {
    logger.error({ err: error }, 'failed to start');
    process.exitCode = 1;
  }
};

const shutdown = async (): Promise<void> => {
  await app.close();
  await pool.end();
  process.exitCode = 0;
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

void start();
