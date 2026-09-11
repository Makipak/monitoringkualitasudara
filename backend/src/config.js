// Single place for env vars and cross-cutting constants (rule.md section 3:
// no magic numbers/values scattered across files). Every other module
// imports from here rather than reading process.env or repeating literals
// directly.
import "dotenv/config";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const MQTT_HOST = requireEnv("MQTT_HOST");
export const MQTT_PORT = Number(process.env.MQTT_PORT ?? 8883);
export const MQTT_USERNAME = requireEnv("MQTT_USERNAME");
export const MQTT_PASSWORD = requireEnv("MQTT_PASSWORD");

// hospital/{device_id}/sensors (architecture.md section 3). The `+`
// wildcard subscribes to every device's topic - v1 only has "room-01",
// but this keeps the backend ready for multi-device without a
// subscribe-side change (prd.md non-functional "Skalabilitas").
export const MQTT_TOPIC_FILTER = "hospital/+/sensors";

// hospital/{device_id}/prediction — the reverse direction of
// MQTT_TOPIC_FILTER. After services/mqtt.js computes a composite-status
// prediction (services/ml.js), it's published back to this per-device
// topic (retained) so the on-device display can show it too, not just the
// mobile app over WebSocket (services/ws.js broadcastPrediction). The
// device subscribes to the same pattern with its own DEVICE_ID — see
// firmware/src/network/mqtt_pub.cpp.
export function predictionTopic(deviceId) {
  return `hospital/${deviceId}/prediction`;
}

export const DATABASE_URL = requireEnv("DATABASE_URL");

export const PORT = Number(process.env.PORT ?? 3000);
export const JWT_SECRET = requireEnv("JWT_SECRET");
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
export const APP_ACCESS_KEY = requireEnv("APP_ACCESS_KEY");

// The 7 official parameters (prd.md section 2, architecture.md 4.1).
// `temperature` is deliberately excluded here - it is stored and shown to
// the app but never evaluated against thresholds or used to trigger
// alerts (schema.md 3.3, architecture.md 2.2 "Catatan suhu ruangan").
export const OFFICIAL_PARAMETERS = [
  "pm25",
  "pm10",
  "no2",
  "co2",
  "tvoc",
  "lux",
  "noise_db",
];

// A device is marked "offline" (schema.md 3.2 `devices.status`) if no
// reading has arrived for this long. Set above the firmware's publish
// interval (5s - firmware/include/config.h SENSOR_READ_INTERVAL_MS, which
// now also drives the MQTT publish tick, see that file's comment) with
// margin for a couple of missed/retried publishes. Left at 90s rather
// than scaled down 1:1 with the interval change, so a brief WiFi/MQTT
// reconnect blip doesn't flap the status; revisit if 90s of apparent
// "online" after an actual disconnect becomes its own real-time concern.
export const DEVICE_OFFLINE_AFTER_MS = 90_000;
export const DEVICE_STATUS_SWEEP_INTERVAL_MS = 30_000;

// ml-service/ (BiGRU composite-status classifier, see services/ml.js).
// Runs on the same host, never reachable from the internet (CLAUDE.md
// "sub-projects never talk directly" rule applies here too, just over
// localhost) - default assumes `uvicorn app:app --port 8001` per
// ml-service/README.md. Override via env for a non-default port/host.
export const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8001";

// Optional shared secret sent as the `X-ML-Service-Token` header on every
// ml.js request. Unset by default because the systemd/VPS deployment above
// still holds (ml-service bound to 127.0.0.1, unreachable regardless of
// auth). Required in practice on shared cPanel hosting (see
// deploy/cpanel-README.md): cPanel's "Setup Python App" always assigns a
// public Application URL - there's no way to keep the app loopback-only
// the way a raw VPS can - so ml-service/app.py enforces this header
// whenever it's configured on that side. Leave both sides unset for a
// true localhost-only deployment; set the same value in both
// backend/.env and the ml-service env var to lock it down on shared
// hosting.
export const ML_SERVICE_SHARED_SECRET = process.env.ML_SERVICE_SHARED_SECRET ?? null;

// Must match ml-service/metadata.json's "window" exactly - there is no
// single source of truth linking the two yet (same caveat that file's
// README already flags for feature order). services/ml.js will refuse to
// call the model with anything other than exactly this many readings.
export const ML_PREDICTION_WINDOW_SIZE = 60;

// Firebase Admin SDK credentials for FCM push notifications
// (architecture.md 6.3, services/push.js). The full service-account JSON
// (from Firebase Console -> Project Settings -> Service Accounts ->
// Generate new private key), base64-encoded into one line so it fits a
// normal .env entry - the raw JSON's multi-line private key does not
// survive naive .env parsing. Deliberately NOT a requireEnv(): push
// notifications are optional/still rolling out (Android only so far, see
// mobile/src/services/notifications.ts), so an unset value must not crash
// the whole backend - services/push.js fails safe (skips sending, logs
// once) the same way evaluateThresholds() does when thresholds aren't
// configured yet.
export const FIREBASE_SERVICE_ACCOUNT_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? null;
