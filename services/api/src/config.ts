const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  port: Number(process.env.PORT ?? 3000),
} as const;
