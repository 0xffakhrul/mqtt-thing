import jwt from '@fastify/jwt';
import type { FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { App } from './app.js';
import { hashPassword, verifyPassword } from './passwords.js';

export type AuthUser = {
  sub: string;
  tenantId: string;
  email: string;
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

declare module 'fastify' {
  interface FastifyContextConfig {
    public?: boolean;
  }
}

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const extractToken = (request: FastifyRequest): string | undefined => {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  if (request.headers.upgrade?.toLowerCase() === 'websocket') {
    const { token } = request.query as { token?: unknown };
    if (typeof token === 'string' && token !== '') return token;
  }

  return undefined;
};

type AuthOptions = {
  pool: pg.Pool;
  secret: string;
  expiresIn: string;
};

export const registerAuth = async (app: App, options: AuthOptions): Promise<void> => {
  if (options.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  await app.register(jwt, {
    secret: options.secret,
    sign: { expiresIn: options.expiresIn },
    verify: { extractToken },
  });

  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.config.public === true) return;

    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  let dummyHash: Promise<string> | undefined;

  app.post('/api/v1/auth/login', { config: { public: true } }, async (request, reply) => {
    const body = LoginBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: z.prettifyError(body.error) });
    }

    const { rows } = await options.pool.query<{
      id: string;
      tenant_id: string;
      email: string;
      password_hash: string;
    }>(
      `SELECT id, tenant_id, email, password_hash
         FROM users
        WHERE lower(email) = lower($1)`,
      [body.data.email],
    );
    const user = rows[0];

    dummyHash ??= hashPassword('not-a-real-password');
    const hash = user?.password_hash ?? (await dummyHash);
    const valid = await verifyPassword(body.data.password, hash);

    if (user === undefined || !valid) {
      return reply.code(401).send({ error: 'invalid email or password' });
    }

    const token = app.jwt.sign({
      sub: user.id,
      tenantId: user.tenant_id,
      email: user.email,
    });
    return { token, user: { email: user.email, tenantId: user.tenant_id } };
  });

  app.get('/api/v1/auth/me', async (request) => ({
    email: request.user.email,
    tenantId: request.user.tenantId,
  }));
};
