// All PostgreSQL access for the backend (architecture.md 4.5). Kept as one
// module because it is a single responsibility - "talk to the database" -
// not because the queries are related to each other; business logic (rule
// evaluation) lives in threshold.js instead.
import pg from "pg";
import { DATABASE_URL, DEVICE_OFFLINE_AFTER_MS, REPORT_TIMEZONE } from "../config.js";

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  // Supabase requires TLS; the certificate chain isn't pinned yet (same
  // trade-off as the firmware's MQTT TLS - see mqtt_pub.cpp setInsecure()
  // comment). Acceptable for skripsi-scale development, revisit before a
  // real deployment.
  ssl: { rejectUnauthorized: false },
});

// Required by the `pg` library's own docs: an idle client's connection can
// drop on its own (network blip, Supabase's pooler recycling an idle
// connection, etc.) and the Pool re-emits that as an 'error' event on
// itself. Node treats an EventEmitter 'error' with no listener as fatal
// and kills the whole process - without this handler, this backend (which
// architecture.md section 8 requires to stay up 24/7 for MQTT) would crash
// every time a pooled connection happened to time out while idle.
pool.on("error", (err) => {
  console.error("[db] idle client error (pool recovers on next query):", err.message);
});

export async function findDeviceByDeviceId(deviceId) {
  const { rows } = await pool.query(
    "SELECT id, device_id, room_id, status, last_seen_at FROM devices WHERE device_id = $1",
    [deviceId],
  );
  return rows[0] ?? null;
}

export async function touchDeviceOnline(internalDeviceId) {
  await pool.query(
    "UPDATE devices SET status = 'online', last_seen_at = now() WHERE id = $1",
    [internalDeviceId],
  );
}

// Run periodically (see index.js) to flip devices that stopped sending
// data to 'offline'. touchDeviceOnline() only ever sets 'online', so
// without this sweep a device that dies mid-stream would stay stuck
// showing 'online' forever.
export async function markStaleDevicesOffline() {
  await pool.query(
    `UPDATE devices SET status = 'offline'
     WHERE status = 'online'
       AND last_seen_at < now() - ($1::double precision / 1000) * interval '1 second'`,
    [DEVICE_OFFLINE_AFTER_MS],
  );
}

export async function insertSensorReading(internalDeviceId, reading) {
  const { rows } = await pool.query(
    `INSERT INTO sensor_readings
       (time, device_id, pm25, pm10, no2, co2, tvoc, lux, noise_db, temperature, humidity)
     VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      internalDeviceId,
      reading.pm25 ?? null,
      reading.pm10 ?? null,
      reading.no2 ?? null,
      reading.co2 ?? null,
      reading.tvoc ?? null,
      reading.lux ?? null,
      reading.noise_db ?? null,
      reading.temperature ?? null,
      reading.humidity ?? null,
    ],
  );
  return rows[0];
}

export async function getLatestReading(internalDeviceId) {
  const { rows } = await pool.query(
    "SELECT * FROM sensor_readings WHERE device_id = $1 ORDER BY time DESC LIMIT 1",
    [internalDeviceId],
  );
  return rows[0] ?? null;
}

// Last `limit` readings for a device, oldest first - the order the ML
// model's window expects (services/ml.js buildWindowPayload). Queried
// DESC+LIMIT (the cheap way to get "the most recent N" from an indexed
// time column) then reversed in JS, rather than a slower "ORDER BY time
// ASC OFFSET (count - limit)".
export async function getRecentReadings(internalDeviceId, limit) {
  const { rows } = await pool.query(
    "SELECT * FROM sensor_readings WHERE device_id = $1 ORDER BY time DESC LIMIT $2",
    [internalDeviceId, limit],
  );
  return rows.reverse();
}

export async function getHistory(internalDeviceId, from, to) {
  const { rows } = await pool.query(
    `SELECT * FROM sensor_readings
     WHERE device_id = $1 AND time BETWEEN $2 AND $3
     ORDER BY time ASC`,
    [internalDeviceId, from, to],
  );
  return rows;
}

// Raw readings for one calendar day, same day-boundary semantics as
// getDailyAggregate() below - both bound to the same [start, end) window
// so they agree on exactly which rows count as "that day" - used by
// services/export.js to build the XLSX/PDF export (prd.md section 9,
// resolved: XLSX = full raw readings + summary/hourly sheets, PDF =
// readable summary + hourly tables, both derived from these same rows).
//
// `date` is a bare YYYY-MM-DD with no UTC offset (mobile's
// useExport.ts sends the device's local calendar day, WIB for this
// hospital) - cast straight to timestamptz that used to silently pick up
// the DB session's default timezone (UTC on Supabase, since nothing else
// in this codebase sets one) instead of WIB, shifting the day boundary by
// 7 hours and making "today"'s export come back empty for the first ~7
// hours of the WIB day. `AT TIME ZONE $3` interprets the date explicitly
// against REPORT_TIMEZONE regardless of the session's own setting - see
// that constant's comment in config.js.
export async function getReadingsForDay(internalDeviceId, date) {
  const { rows } = await pool.query(
    `SELECT * FROM sensor_readings
     WHERE device_id = $1
       AND time >= ($2::date)::timestamp AT TIME ZONE $3
       AND time < ($2::date + 1)::timestamp AT TIME ZONE $3
     ORDER BY time ASC`,
    [internalDeviceId, date, REPORT_TIMEZONE],
  );
  return rows;
}

// Daily aggregate (schema.md section 4, "Agregasi harian ... untuk
// export") - single avg per parameter for the whole day. Kept as the
// plain-JSON default response of GET .../export (no `format` query
// param); services/export.js computes its own richer summary (avg/min/
// max/status) from getReadingsForDay() instead of this. Same day-window
// fix as getReadingsForDay() above; `day` echoes the requested date
// directly rather than re-deriving it from `time` (which would reopen
// the same session-timezone dependency just for this cosmetic field).
export async function getDailyAggregate(internalDeviceId, date) {
  const { rows } = await pool.query(
    `SELECT
       $2::date AS day,
       avg(pm25) AS avg_pm25,
       avg(pm10) AS avg_pm10,
       avg(no2) AS avg_no2,
       avg(co2) AS avg_co2,
       avg(tvoc) AS avg_tvoc,
       avg(lux) AS avg_lux,
       avg(noise_db) AS avg_noise_db
     FROM sensor_readings
     WHERE device_id = $1
       AND time >= ($2::date)::timestamp AT TIME ZONE $3
       AND time < ($2::date + 1)::timestamp AT TIME ZONE $3
     GROUP BY 1`,
    [internalDeviceId, date, REPORT_TIMEZONE],
  );
  return rows[0] ?? null;
}

export async function getThresholds() {
  const { rows } = await pool.query("SELECT * FROM thresholds");
  return rows;
}

export async function getOpenAlert(internalDeviceId, parameter) {
  const { rows } = await pool.query(
    `SELECT * FROM alerts
     WHERE device_id = $1 AND parameter = $2 AND resolved_at IS NULL
     ORDER BY triggered_at DESC LIMIT 1`,
    [internalDeviceId, parameter],
  );
  return rows[0] ?? null;
}

export async function insertAlert(internalDeviceId, alertInfo) {
  const { rows } = await pool.query(
    `INSERT INTO alerts (device_id, parameter, value, threshold_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [internalDeviceId, alertInfo.parameter, alertInfo.value, alertInfo.thresholdId],
  );
  return rows[0];
}

export async function resolveAlert(alertId) {
  await pool.query("UPDATE alerts SET resolved_at = now() WHERE id = $1", [alertId]);
}

// Alert history for the mobile Notifikasi screen (routes/rooms.js
// GET .../notifications) - newest first, joined with `thresholds` so
// services/threshold.js's describeAlert() can recompute direction/
// recommendation for display (alerts rows don't store those themselves).
export async function getAlertHistory(internalDeviceId, limit) {
  const { rows } = await pool.query(
    `SELECT a.id, a.parameter, a.value, a.threshold_id, a.triggered_at, a.resolved_at,
            t.min_value, t.max_value
     FROM alerts a
     LEFT JOIN thresholds t ON t.id = a.threshold_id
     WHERE a.device_id = $1
     ORDER BY a.triggered_at DESC
     LIMIT $2`,
    [internalDeviceId, limit],
  );
  return rows;
}

// Composite-status predictions from the BiGRU classifier (schema.md 3.6),
// separate from the rule-based `alerts` above.
export async function insertPrediction(internalDeviceId, prediction) {
  const { rows } = await pool.query(
    `INSERT INTO predictions (device_id, label, class_index, probabilities, model_version)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      internalDeviceId,
      prediction.label,
      prediction.class_index,
      JSON.stringify(prediction.probabilities),
      prediction.model_version,
    ],
  );
  return rows[0];
}

export async function getLatestPrediction(internalDeviceId) {
  const { rows } = await pool.query(
    "SELECT * FROM predictions WHERE device_id = $1 ORDER BY time DESC LIMIT 1",
    [internalDeviceId],
  );
  return rows[0] ?? null;
}

// FCM push notification tokens (schema.md 3.7 device_push_tokens),
// deliberately not scoped to a device/room - one row per app install, not
// per monitored room (v1 is single-device anyway, see prd.md section 3).
export async function upsertPushToken(fcmToken, platform) {
  await pool.query(
    `INSERT INTO device_push_tokens (fcm_token, platform)
     VALUES ($1, $2)
     ON CONFLICT (fcm_token) DO UPDATE SET platform = EXCLUDED.platform`,
    [fcmToken, platform],
  );
}

export async function getAllPushTokens() {
  const { rows } = await pool.query("SELECT fcm_token FROM device_push_tokens");
  return rows.map((row) => row.fcm_token);
}

// Called both when the app explicitly unregisters (e.g. user disables
// notifications) and when services/push.js reports a token FCM considers
// permanently invalid.
export async function deletePushToken(fcmToken) {
  await pool.query("DELETE FROM device_push_tokens WHERE fcm_token = $1", [fcmToken]);
}
