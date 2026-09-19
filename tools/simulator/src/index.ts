import { randomUUID } from 'node:crypto';
import { createLogger } from '@mqtt-thing/logger';
import mqtt from 'mqtt';

const logger = createLogger('simulator');

const mqttUrl = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const tenantId = process.env.SIM_TENANT_ID ?? 'demo';
const deviceId = process.env.SIM_DEVICE_ID ?? 'sim-001';
const intervalMs = Number(process.env.SIM_INTERVAL_MS ?? 2000);
const duplicateRate = Number(process.env.SIM_DUPLICATE_RATE ?? 0);
const dropRate = Number(process.env.SIM_DROP_RATE ?? 0);
const skewMs = Number(process.env.SIM_SKEW_MS ?? 0);

const topic = `v1/${tenantId}/devices/${deviceId}/telemetry`;

const drift = (current: number, step: number, min: number, max: number): number => {
  const next = current + (Math.random() - 0.5) * step;
  return Math.min(max, Math.max(min, Number(next.toFixed(2))));
};

const state = { temp_c: 27, rh_pct: 68, co2_ppm: 800 };
let seq = 0;

const client = mqtt.connect(mqttUrl, {
  clientId: `simulator-${deviceId}-${randomUUID()}`,
  clean: true,
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  logger.info({ mqttUrl, topic, intervalMs }, 'simulator connected');

  setInterval(() => {
    state.temp_c = drift(state.temp_c, 0.6, 18, 38);
    state.rh_pct = drift(state.rh_pct, 2, 30, 95);
    state.co2_ppm = drift(state.co2_ppm, 40, 400, 1600);
    seq += 1;

    // A dropped message still burns its sequence number — exactly what a device
    // with a flaky uplink does, and what makes gaps detectable downstream.
    if (Math.random() < dropRate) {
      logger.info({ seq }, 'dropped message on purpose');
      return;
    }

    const payload = JSON.stringify({
      seq,
      ts: new Date(Date.now() + skewMs).toISOString(),
      readings: { ...state },
    });

    const send = (attempt: number): void => {
      client.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          logger.error({ err: error, attempt }, 'publish failed');
          return;
        }
        logger.debug({ seq, attempt }, 'published');
      });
    };

    send(1);

    // QoS 1 redelivery: byte-identical payload, same seq, same ts.
    if (Math.random() < duplicateRate) {
      logger.info({ seq }, 'republishing duplicate on purpose');
      send(2);
    }
  }, intervalMs);
});

client.on('error', (error) => logger.error({ err: error }, 'mqtt error'));

const shutdown = (): void => {
  client.end(false, {}, () => {
    process.exitCode = 0;
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
