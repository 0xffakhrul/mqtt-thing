import { randomUUID } from 'node:crypto';
import { createLogger } from '@mqtt-thing/logger';
import mqtt from 'mqtt';
import { config } from './config.js';
import { createPool, insertReadings } from './db.js';
import { parseTelemetry } from './telemetry.js';

const logger = createLogger('ingestion');
const pool = createPool(config.databaseUrl);

const TELEMETRY_WILDCARD = 'v1/+/devices/+/telemetry';

const client = mqtt.connect(config.mqttUrl, {
  clientId: `ingestion-${randomUUID()}`,
  clean: true,
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  client.subscribe(TELEMETRY_WILDCARD, { qos: 1 }, (error) => {
    if (error) {
      logger.error({ err: error }, 'subscribe failed');
      return;
    }
    logger.info({ topic: TELEMETRY_WILDCARD }, 'subscribed');
  });
});

client.on('error', (error) => logger.error({ err: error }, 'mqtt error'));
client.on('reconnect', () => logger.warn('mqtt reconnecting'));

client.on('message', (topic, payload) => {
  const parsed = parseTelemetry(topic, payload.toString('utf8'));

  if (!parsed.ok) {
    logger.warn({ topic, reason: parsed.reason }, 'rejected telemetry message');
    return;
  }

  insertReadings(pool, parsed.readings)
    .then((count) => logger.debug({ topic, count }, 'inserted readings'))
    .catch((error: unknown) => logger.error({ err: error, topic }, 'insert failed'));
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, 'shutting down');
  client.end(false, {}, () => {
    void pool.end().then(() => {
      process.exitCode = 0;
    });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
