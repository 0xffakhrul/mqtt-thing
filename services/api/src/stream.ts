import type { IncomingMessage, ServerResponse } from 'node:http';
import '@fastify/websocket';
import type { Logger } from '@mqtt-thing/logger';
import type { FastifyInstance, RawServerDefault } from 'fastify';
import { Redis } from 'ioredis';
import { z } from 'zod';

const StreamQuery = z.object({
  tenantId: z.string().min(1),
  deviceId: z.string().min(1).optional(),
});

type App = FastifyInstance<RawServerDefault, IncomingMessage, ServerResponse, Logger>;

export const registerStream = (app: App, redisUrl: string, logger: Logger): void => {
  const subscriber = new Redis(redisUrl);
  const sockets = new Set<{
    tenantId: string;
    deviceId?: string;
    send: (data: string) => void;
  }>();

  void subscriber.psubscribe('readings:*', (error) => {
    if (error) {
      logger.error({ err: error }, 'redis psubscribe failed');
      return;
    }
    logger.info({ pattern: 'readings:*' }, 'subscribed to reading events');
  });

  subscriber.on('pmessage', (_pattern, channel, payload) => {
    const tenantId = channel.slice('readings:'.length);

    for (const socket of sockets) {
      if (socket.tenantId !== tenantId) continue;
      if (socket.deviceId !== undefined && !payload.includes(`"deviceId":"${socket.deviceId}"`)) {
        continue;
      }
      socket.send(payload);
    }
  });

  app.get('/api/v1/stream', { websocket: true }, (socket, request) => {
    const query = StreamQuery.safeParse(request.query);
    if (!query.success) {
      socket.close(1008, 'tenantId is required');
      return;
    }

    const entry = {
      tenantId: query.data.tenantId,
      ...(query.data.deviceId === undefined ? {} : { deviceId: query.data.deviceId }),
      send: (data: string) => socket.send(data),
    };

    sockets.add(entry);
    logger.info({ tenantId: entry.tenantId, clients: sockets.size }, 'stream client connected');

    socket.on('close', () => {
      sockets.delete(entry);
      logger.info({ clients: sockets.size }, 'stream client disconnected');
    });
  });

  app.addHook('onClose', () => {
    subscriber.disconnect();
  });
};
