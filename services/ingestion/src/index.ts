import { randomUUID } from 'node:crypto';
import { createLogger } from '@mqtt-thing/logger';
import mqtt from 'mqtt';
import { config } from './config.js';
import { createPool, insertReadings, updateLatest } from './db.js';
import { channelFor, createPublisher, createThrottle, toEvent } from './events.js';
import { parseTelemetry, type Reading } from './telemetry.js';

const logger = createLogger('ingestion');
const pool = createPool(config.databaseUrl);
const publisher = createPublisher(config.redisUrl);

const TELEMETRY_WILDCARD = 'v1/+/devices/+/telemetry';

let redisDown = false;
let droppedEvents = 0;
const reportDrops = createThrottle(30_000);

publisher.on('ready', () => {
  redisDown = false;
  logger.info('redis ready');
});

publisher.on('error', (error) => {
  if (redisDown) return;
  redisDown = true;
  logger.warn({ err: error }, 'redis unavailable; live events will be dropped until it returns');
});

const recordDroppedEvent = (error: unknown): void => {
  droppedEvents += 1;
  if (!reportDrops()) return;
  logger.warn({ dropped: droppedEvents, err: error }, 'dropping live events; redis not connected');
  droppedEvents = 0;
};

const handleReadings = async (topic: string, readings: Reading[]): Promise<void> => {
  const { inserted, duplicates } = await insertReadings(pool, readings);
  if (duplicates > 0) {
    logger.info({ topic, inserted, duplicates }, 'dropped duplicate readings');
    return;
  }

  await updateLatest(pool, readings);

  // Live fanout is best effort: if redis is down the reading is still stored,
  // the dashboard just doesn't get the push.
  const event = toEvent(readings);
  if (event !== null) {
    publisher.publish(channelFor(event.tenantId), JSON.stringify(event)).catch(recordDroppedEvent);
  }

  logger.debug({ topic, inserted }, 'inserted readings');
};

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

  handleReadings(topic, parsed.readings).catch((error: unknown) =>
    logger.error({ err: error, topic }, 'write failed'),
  );
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, 'shutting down');
  client.end(false, {}, () => {
    publisher.disconnect();
    void pool.end().then(() => {
      process.exitCode = 0;
    });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
