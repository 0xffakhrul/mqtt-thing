const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  mqttUrl: required('MQTT_URL'),
  databaseUrl: required('DATABASE_URL'),
} as const;
