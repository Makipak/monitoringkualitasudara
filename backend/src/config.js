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

// Workaround for shared cPanel hosting (deploy/cpanel-README.md) whose
// firewall blocks most of Google's IP space via an automated abuse-
// detection system that the host has confirmed (2026-09-13 support
// ticket) it will not disable for a blanket allowlist - individual IPs
// can be whitelisted, but oauth2.googleapis.com's anycast DNS returns a
// different IP practically every call, so per-IP whitelisting never
// reliably works (confirmed live: two different IPs, from two different
// subnets, both timed out across two separate test calls). Google
// publishes a small, STABLE IP range specifically for exactly this
// "restricted egress" scenario - "Private Google Access"
// (private.googleapis.com, 199.36.153.8/30) - once the host whitelists
// that instead, set this to "199.36.153.8" and services/googleDnsPin.js
// pins every *.googleapis.com DNS lookup to it (SNI/Host-based routing
// on Google's end means the literal IP doesn't matter as long as it's
// one Google actually recognizes). Leave unset (null) anywhere DNS
// isn't artificially restricted - a raw VPS, local dev, or once/if this
// host's firewall situation changes.
export const GOOGLE_API_DNS_PIN_IP = process.env.GOOGLE_API_DNS_PIN_IP ?? null;

// Local calendar-day boundary for the daily export report only
// (services/db.js getReadingsForDay()/getDailyAggregate(), called from
// routes/rooms.js .../export). mobile/src/hooks/useExport.ts sends a bare
// "today" as a YYYY-MM-DD string - the device's local calendar day (WIB
// for this hospital), with no UTC offset attached. Postgres has no
// timezone configured anywhere else in this codebase (grep for
// "TimeZone"/"Asia/Jakarta" turns up nothing outside this constant), so a
// bare date cast to timestamptz used to fall back to the DB session's
// default timezone (UTC on Supabase) instead of WIB - silently shifting
// the day boundary by 7 hours. Concretely: during the first ~7 hours of
// the WIB calendar day, every reading already inserted "today" was still
// bucketed under UTC "yesterday", so exporting "today" came back with
// zero rows (an XLSX with headers only / a PDF's explicit "no data" page)
// even though the dashboard/history showed live data just fine - those
// use precise ISO instants (useParameterHistory.ts's .toISOString()), not
// a bare calendar date, so they never hit this. The two export queries
// now interpret the date string against this zone explicitly (AT TIME
// ZONE) instead of relying on the session default.
export const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE ?? "Asia/Jakarta";
