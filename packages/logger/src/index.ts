import pino from 'pino';

export type Logger = pino.Logger;

const isProduction = process.env.NODE_ENV === 'production';

export const createLogger = (service: string): Logger =>
  pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        '*.password',
        'secret',
        '*.secret',
        'deviceSecret',
        '*.deviceSecret',
        'token',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
        }),
  });
