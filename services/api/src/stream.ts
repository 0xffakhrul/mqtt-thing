import '@fastify/websocket';
import type { Logger } from '@mqtt-thing/logger';
import { Redis } from 'ioredis';
import { z } from 'zod';
import type { App } from './app.js';

const StreamQuery = z.object({
  deviceId: z.string().min(1).optional(),
});

const deviceIdOf = (payload: string): string | undefined => {
  try {
    const { deviceId } = JSON.parse(payload) as { deviceId?: unknown };
    return typeof deviceId === 'string' ? deviceId : undefined;
  } catch {
    return undefined;
  }
};

export const registerStream = (app: App, redisUrl: string, logger: Logger): void => {
  const subscriber = new Redis(redisUrl);

  let redisDown = false;
  subscriber.on('error', (error) => {
    if (redisDown) return;
    redisDown = true;
    logger.warn({ err: error }, 'redis unavailable; live stream paused until it returns');
  });
  subscriber.on('ready', () => {
    if (!redisDown) return;
    redisDown = false;
    logger.info('redis back; live stream resumed');
  });

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
    const deviceId = deviceIdOf(payload);

    for (const socket of sockets) {
      if (socket.tenantId !== tenantId) continue;
      if (socket.deviceId !== undefined && socket.deviceId !== deviceId) continue;
      socket.send(payload);
    }
  });

  // The auth hook has already checked the token before the upgrade, so
  // request.user is set and the tenant comes from it, not from the URL.
  app.get('/api/v1/stream', { websocket: true }, (socket, request) => {
    const query = StreamQuery.safeParse(request.query);
    if (!query.success) {
      socket.close(1008, 'invalid query');
      return;
    }

    const entry = {
      tenantId: request.user.tenantId,
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
