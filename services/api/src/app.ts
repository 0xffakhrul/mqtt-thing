import type { IncomingMessage, ServerResponse } from 'node:http';
import websocket from '@fastify/websocket';
import type { Logger } from '@mqtt-thing/logger';
import Fastify, { type FastifyInstance, type FastifyRequest, type RawServerDefault } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { registerAuth } from './auth.js';
import { bucketFor } from './downsample.js';
import { listDevices, readSeries } from './queries.js';
import { registerStream } from './stream.js';

export type App = FastifyInstance<RawServerDefault, IncomingMessage, ServerResponse, Logger>;

export type AppOptions = {
  pool: pg.Pool;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  logger: Logger;
};

const SeriesQuery = z.object({
  metric: z.string().min(1),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  maxPoints: z.coerce.number().int().min(10).max(5000).default(500),
});

const serializeRequest = (request: FastifyRequest) => ({
  method: request.method,
  url: request.url.replace(/([?&]token=)[^&]*/, '$1[REDACTED]'),
  host: request.host,
  remoteAddress: request.ip,
  remotePort: request.socket.remotePort,
});

export const buildApp = async (options: AppOptions): Promise<App> => {
  const { pool } = options;
  const app = Fastify({
    loggerInstance: options.logger.child({}, { serializers: { req: serializeRequest } }),
  });

  await app.register(websocket);
  await registerAuth(app, {
    pool,
    secret: options.jwtSecret,
    expiresIn: options.jwtExpiresIn,
  });
  registerStream(app, options.redisUrl, options.logger);

  app.get('/health', { config: { public: true } }, async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  });

  app.get('/api/v1/devices', async (request) => ({
    devices: await listDevices(pool, request.user.tenantId),
  }));

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
      tenantId: request.user.tenantId,
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

  return app;
};
