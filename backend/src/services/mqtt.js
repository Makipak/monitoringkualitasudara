// Subscribes to HiveMQ Cloud and runs the full ingest pipeline for each
// reading (architecture.md 4.1/4.2): validate -> resolve device -> store
// -> evaluate thresholds -> update alerts -> broadcast to app clients.
import mqtt from "mqtt";
import {
  MQTT_HOST,
  MQTT_PORT,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC_FILTER,
  OFFICIAL_PARAMETERS,
  ML_PREDICTION_WINDOW_SIZE,
} from "../config.js";
import { validateReadingPayload } from "../validate.js";
import {
  findDeviceByDeviceId,
  touchDeviceOnline,
  insertSensorReading,
  getRecentReadings,
  insertPrediction,
  getThresholds,
  getOpenAlert,
  insertAlert,
  resolveAlert,
} from "./db.js";
import { evaluateThresholds } from "./threshold.js";
import { buildWindowPayload, requestPrediction } from "./ml.js";
import { broadcastToClients, broadcastPrediction } from "./ws.js";

// Tracks the last logged reason (per device) a prediction window was
// skipped, so runPredictionStep doesn't spam the log every ~5s while the
// CO2/lux/temperature/humidity sensors are physically uninstalled (see
// ml-service/README.md) - only logs again when the reason actually
// changes for that device.
const lastPredictionSkipReason = new Map();

export function startMqttSubscriber() {
  const url = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;
  const client = mqtt.connect(url, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    // rejectUnauthorized defaults to true here - the TLS certificate chain
    // IS verified (rule.md section 6: MQTT must use real TLS, not just an
    // encrypted-but-unverified channel like the firmware's setInsecure()
    // shortcut).
  });

  client.on("connect", () => {
    console.log(`[mqtt] connected to ${MQTT_HOST}, subscribing to ${MQTT_TOPIC_FILTER}`);
    client.subscribe(MQTT_TOPIC_FILTER, (err, granted) => {
      if (err) {
        console.error(`[mqtt] subscribe failed for ${MQTT_TOPIC_FILTER}:`, err.message);
        return;
      }
      // HiveMQ Cloud grants qos 128 (0x80) when the credential lacks
      // permission for this topic pattern - the connect still succeeds,
      // so this is the only place that failure surfaces.
      for (const { topic, qos } of granted) {
        if (qos === 128) {
          console.error(
            `[mqtt] subscribe to "${topic}" was denied by the broker - check ` +
              `this credential's topic permissions in HiveMQ Cloud (Access Management)`,
          );
        } else {
          console.log(`[mqtt] subscribed to "${topic}" (qos ${qos})`);
        }
      }
    });
  });

  client.on("reconnect", () => console.log("[mqtt] reconnecting..."));
  client.on("error", (err) => console.error("[mqtt] error:", err.message));

  client.on("message", (topic, payload) => {
    handleMessage(payload).catch((err) => {
      console.error(`[mqtt] failed to process message on ${topic}:`, err.message);
    });
  });

  return client;
}

async function handleMessage(payload) {
  const raw = JSON.parse(payload.toString());
  const reading = validateReadingPayload(raw);

  const device = await findDeviceByDeviceId(reading.device_id);
  if (!device) {
    console.warn(
      `[mqtt] ignoring reading from unknown device_id "${reading.device_id}" - ` +
        "add it to the devices table first (see sql/seed.sql)",
    );
    return;
  }

  await touchDeviceOnline(device.id);
  const storedReading = await insertSensorReading(device.id, reading);

  const thresholds = await getThresholds();
  const outOfRange = evaluateThresholds(reading, thresholds);
  const outOfRangeParams = new Set(outOfRange.map((a) => a.parameter));

  const newAlerts = [];
  for (const parameter of OFFICIAL_PARAMETERS) {
    if (reading[parameter] === undefined) continue;

    const isOutOfRange = outOfRangeParams.has(parameter);
    const openAlert = await getOpenAlert(device.id, parameter);

    if (isOutOfRange && !openAlert) {
      const alertInfo = outOfRange.find((a) => a.parameter === parameter);
      const inserted = await insertAlert(device.id, alertInfo);
      newAlerts.push(inserted);
    } else if (!isOutOfRange && openAlert) {
      await resolveAlert(openAlert.id);
    }
  }

  if (newAlerts.length > 0) {
    // FCM push notification is a known placeholder - see backend/README.md
    // "Known placeholders" (no Firebase project/credentials set up yet).
    // Logged here so the alert path stays visible end-to-end during
    // development/demo.
    console.log(
      `[alerts] device=${reading.device_id} new out-of-range: ${newAlerts
        .map((a) => a.parameter)
        .join(", ")}`,
    );
  }

  broadcastToClients(storedReading, outOfRange);

  await runPredictionStep(device.id);
}

// Composite-status classification (services/ml.js), alongside - not
// replacing - the rule-based evaluateThresholds() above. Wrapped so an
// ml-service outage or a malformed window never breaks the core sensor
// ingest pipeline that the rest of handleMessage depends on.
async function runPredictionStep(internalDeviceId) {
  try {
    const readings = await getRecentReadings(internalDeviceId, ML_PREDICTION_WINDOW_SIZE);
    const windowPayload = buildWindowPayload(readings);

    if (!windowPayload) {
      const reason =
        readings.length < ML_PREDICTION_WINDOW_SIZE
          ? `only ${readings.length}/${ML_PREDICTION_WINDOW_SIZE} readings so far`
          : "latest window has one or more incomplete readings (missing sensor data)";
      if (lastPredictionSkipReason.get(internalDeviceId) !== reason) {
        lastPredictionSkipReason.set(internalDeviceId, reason);
        console.log(`[prediction] device=${internalDeviceId} skipped - ${reason}`);
      }
      return;
    }
    lastPredictionSkipReason.delete(internalDeviceId);

    const prediction = await requestPrediction(windowPayload);
    const stored = await insertPrediction(internalDeviceId, prediction);
    // Same shape as GET /api/rooms/:deviceId/prediction's success response
    // (routes/rooms.js), so the mobile client's Prediction type covers
    // both the REST and WebSocket paths.
    broadcastPrediction({
      available: true,
      time: stored.time,
      label: stored.label,
      class_index: stored.class_index,
      probabilities: stored.probabilities,
      model_version: stored.model_version,
    });
  } catch (err) {
    console.error(`[prediction] device=${internalDeviceId} failed:`, err.message);
  }
}
