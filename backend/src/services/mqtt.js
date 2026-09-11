// Subscribes to HiveMQ Cloud and runs the full ingest pipeline for each
// reading (architecture.md 4.1/4.2): validate -> resolve device -> store
// -> evaluate thresholds -> update alerts -> broadcast to app clients ->
// (once a full window is available) run the composite-status prediction
// and publish it back to the device over MQTT, not just to the mobile app
// over WebSocket.
import mqtt from "mqtt";
import {
  MQTT_HOST,
  MQTT_PORT,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC_FILTER,
  OFFICIAL_PARAMETERS,
  ML_PREDICTION_WINDOW_SIZE,
  predictionTopic,
} from "../config.js";
import { validateReadingPayload } from "../validate.js";
import {
  findDeviceByDeviceId,
  touchDeviceOnline,
  insertSensorReading,
  getRecentReadings,
  insertPrediction,
  getLatestPrediction,
  getThresholds,
  getOpenAlert,
  insertAlert,
  resolveAlert,
  getAllPushTokens,
  deletePushToken,
} from "./db.js";
import { evaluateThresholds } from "./threshold.js";
import { buildWindowPayload, requestPrediction } from "./ml.js";
import { sendAlertPush } from "./push.js";
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
    handleMessage(payload, client).catch((err) => {
      console.error(`[mqtt] failed to process message on ${topic}:`, err.message);
    });
  });

  return client;
}

async function handleMessage(payload, client) {
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
    // Per-parameter alerts no longer send a push notification themselves
    // (superseded by the composite-label push in runPredictionStep() below,
    // per user decision) - they still open/resolve here and stay visible
    // via the Notifikasi screen (GET .../notifications) and the Dashboard's
    // "Peringatan Aktif"/Rekomendasi cards, just silently.
    console.log(
      `[alerts] device=${reading.device_id} new out-of-range: ${newAlerts
        .map((a) => a.parameter)
        .join(", ")}`,
    );
  }

  broadcastToClients(storedReading, outOfRange);

  await runPredictionStep(device.id, reading.device_id, client);
}

// Composite-status labels (ml-service/metadata.json label_map) that count
// as "worth waking someone up for" - push notifications fire only on
// entering this set, not on every parameter-level threshold breach
// (per-parameter `alerts` still exist for history/Dashboard display, see
// handleMessage() above - they just no longer push on their own, per user
// decision superseding the earlier per-parameter push).
const PREDICTION_ALERT_LABELS = new Set(["Peringatan", "Bahaya"]);

// Push notification for the composite AI status entering Peringatan/Bahaya
// (architecture.md 6.3), via services/push.js (FCM). Sent to every
// registered device_push_tokens row - v1 has no per-user targeting
// (schema.md 3.7 note: not yet tied to a users table).
async function sendPredictionAlertNotification(prediction, externalDeviceId) {
  const tokens = await getAllPushTokens();
  if (tokens.length === 0) return;

  const title =
    prediction.label === "Bahaya"
      ? `Kualitas udara ${externalDeviceId}: BAHAYA`
      : `Kualitas udara ${externalDeviceId}: Peringatan`;
  const confidencePct = Math.round((prediction.probabilities[prediction.label] ?? 0) * 100);
  const body = `Model memprediksi status "${prediction.label}" (keyakinan ${confidencePct}%). Periksa kondisi ruangan.`;

  const { invalidTokens } = await sendAlertPush(tokens, { title, body });
  if (invalidTokens.length > 0) {
    await Promise.all(invalidTokens.map((token) => deletePushToken(token)));
  }
}

// Composite-status classification (services/ml.js), alongside - not
// replacing - the rule-based evaluateThresholds() above. Wrapped so an
// ml-service outage or a malformed window never breaks the core sensor
// ingest pipeline that the rest of handleMessage depends on.
//
// `externalDeviceId` (the device_id string from the payload, e.g.
// "room-01") is needed alongside the internal DB id (`internalDeviceId`)
// only to build the MQTT publish-back topic - the device itself has no
// concept of the internal id.
async function runPredictionStep(internalDeviceId, externalDeviceId, client) {
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

    // Fetched before inserting the new row below, specifically so it's
    // "the label as of the previous prediction cycle" - the comparison
    // just after insertPrediction() depends on this ordering to detect a
    // transition rather than comparing a row against itself.
    const previousPrediction = await getLatestPrediction(internalDeviceId);

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

    // Push notification only on *entering* Peringatan/Bahaya (not every
    // cycle the model keeps reporting one of those two labels, and not on
    // Peringatan<->Bahaya movement within the zone) - mirrors the
    // open/resolve-once shape of the old per-parameter alerts this
    // replaced. previousPrediction is null on a device's very first-ever
    // prediction, which correctly counts as "entering" if that first
    // label already lands in the alert zone.
    const wasInAlertZone = PREDICTION_ALERT_LABELS.has(previousPrediction?.label);
    const isInAlertZone = PREDICTION_ALERT_LABELS.has(stored.label);
    if (isInAlertZone && !wasInAlertZone) {
      try {
        await sendPredictionAlertNotification(stored, externalDeviceId);
      } catch (err) {
        console.error(`[push] device=${internalDeviceId} failed to send prediction push:`, err.message);
      }
    }

    // Publish back over MQTT too, so the on-device display (not just the
    // WebSocket-connected mobile app) can show the composite status - see
    // firmware/src/network/mqtt_pub.cpp's subscribe side. Deliberately a
    // small payload (just what the device actually renders) rather than
    // reusing the full broadcastPrediction() shape - the device has no
    // use for probabilities/model_version and MQTT_MAX_PACKET_SIZE on the
    // firmware side is limited (512B, see firmware/platformio.ini).
    // retain:true so a device that (re)connects after this point gets the
    // last known label immediately rather than waiting for the next
    // full-window prediction.
    client.publish(
      predictionTopic(externalDeviceId),
      JSON.stringify({ device_id: externalDeviceId, label: stored.label }),
      { qos: 0, retain: true },
    );
  } catch (err) {
    console.error(`[prediction] device=${internalDeviceId} failed:`, err.message);
  }
}
