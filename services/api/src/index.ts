import { createLogger } from '@mqtt-thing/logger';
import Fastify from 'fastify';
import pg from 'pg';
import { z } from 'zod';
import { config } from './config.js';
import { bucketFor } from './downsample.js';
import { listDevices, readSeries } from './queries.js';

const { Pool } = pg;

const logger = createLogger('api');
const pool = new Pool({ connectionString: config.databaseUrl });
const app = Fastify({ loggerInstance: logger });

const TenantQuery = z.object({ tenantId: z.string().min(1) });

const SeriesQuery = TenantQuery.extend({
  metric: z.string().min(1),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  maxPoints: z.coerce.number().int().min(10).max(5000).default(500),
});

app.get('/health', async () => {
  await pool.query('SELECT 1');
  return { status: 'ok' };
});

app.get('/api/v1/devices', async (request, reply) => {
  const query = TenantQuery.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({ error: z.prettifyError(query.error) });
  }

  return { devices: await listDevices(pool, query.data.tenantId) };
});

app.get('/api/v1/devices/:deviceId/series', async (request, reply) => {
  const params = z.object({ deviceId: z.string().min(1) }).safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({ error: z.prettifyError(params.error) });
  }

  const query = SeriesQuery.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({ error: z.prettifyError(query.error) });
  }

  const to = query.data.to === undefined ? new Date() : new Date(query.data.to);
  const from =
    query.data.from === undefined
      ? new Date(to.getTime() - 60 * 60 * 1000)
      : new Date(query.data.from);

  if (from >= to) {
    return reply.code(400).send({ error: 'from must be earlier than to' });
  }

  const bucket = bucketFor(from, to, query.data.maxPoints);

  const points = await readSeries(pool, {
    tenantId: query.data.tenantId,
    deviceId: params.data.deviceId,
    metric: query.data.metric,
    from,
    to,
    bucket,
  });

  return {
    deviceId: params.data.deviceId,
    metric: query.data.metric,
    from: from.toISOString(),
    to: to.toISOString(),
    bucket,
    count: points.length,
    points,
  };
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
