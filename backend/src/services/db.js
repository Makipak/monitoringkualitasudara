// All PostgreSQL access for the backend (architecture.md 4.5). Kept as one
// module because it is a single responsibility - "talk to the database" -
// not because the queries are related to each other; business logic (rule
// evaluation) lives in threshold.js instead.
import pg from "pg";
import { DATABASE_URL, DEVICE_OFFLINE_AFTER_MS } from "../config.js";

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
    "SELECT id, device_id, room_id, status FROM devices WHERE device_id = $1",
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

// Daily aggregate (schema.md section 4, "Agregasi harian ... untuk
// export"). The actual export file format (CSV/PDF) is still an open PRD
// question (prd.md section 9) - this returns the aggregate as JSON until
// that's decided.
export async function getDailyAggregate(internalDeviceId, date) {
  const { rows } = await pool.query(
    `SELECT
       date_trunc('day', time) AS day,
       avg(pm25) AS avg_pm25,
       avg(pm10) AS avg_pm10,
       avg(no2) AS avg_no2,
       avg(co2) AS avg_co2,
       avg(tvoc) AS avg_tvoc,
       avg(lux) AS avg_lux,
       avg(noise_db) AS avg_noise_db
     FROM sensor_readings
     WHERE device_id = $1
       AND time >= date_trunc('day', $2::timestamptz)
       AND time < date_trunc('day', $2::timestamptz) + interval '1 day'
     GROUP BY day`,
    [internalDeviceId, date],
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
