# backend

Node.js backend for the Udara hospital air quality monitoring system - MQTT
subscriber, REST API, and WebSocket broadcast - see `../architecture.md`
section 4 for the full design.

## Setup

Supabase project "udara" (ref `hvmmvglvowqyoixihnpw`, region ap-southeast-1)
already exists with `sql/schema.sql` and `sql/seed.sql` applied, including
`ROW LEVEL SECURITY` enabled with no policies on all 6 tables (default-deny
for Supabase's auto-generated PostgREST/anon-key API, which this backend
does not use - it connects as `postgres`, which owns these tables and
bypasses RLS). Get the DB password from that project's Settings -> Database
page (not retrievable via API - only shown once at creation, or via
"Reset database password" there).

Use the **Supavisor session pooler** connection string (see
`.env.example`), not Supabase's "direct connection" - the direct host is
IPv6-only and will hang (`ETIMEDOUT`) on an IPv4-only network, which is
common on residential ISPs and is what happened during this project's
initial setup.

```sh
cd backend
npm install
cp .env.example .env
# edit .env - fill in the DB password + real HiveMQ Cloud credentials

npm start        # node src/index.js
npm run dev       # node --watch src/index.js, restarts on file change
```

Pointing at a different/fresh Supabase project instead: run
`psql "$DATABASE_URL" -f sql/schema.sql` then `sql/seed.sql` once before
`npm start`.

## Structure

```
src/
  config.js              env vars + constants (single place, see rule.md section 3)
  validate.js             structural/range check on incoming MQTT payloads
  app.js                  Express app (routes, auth, error handling)
  index.js                entry point, wires app + WebSocket + MQTT together
  services/
    mqtt.js               subscribe HiveMQ, run the ingest pipeline per message
    db.js                 all PostgreSQL access (Supabase)
    threshold.js           rule-based evaluation + recommendation text (architecture.md 4.2a)
    ws.js                  broadcast realtime updates to connected app clients
  middleware/
    auth.js                 JWT verification for REST routes
  routes/
    auth.js                 POST /api/auth/token (see "Known placeholders")
    rooms.js                 GET endpoints from architecture.md 4.3
sql/
  schema.sql               CREATE TABLE statements (source of truth: ../schema.md)
  seed.sql                  v1 single-device/single-room row (device_id "room-01")
```

## REST API

All routes except `/health` and `/api/auth/token` require
`Authorization: Bearer <token>`.

| Method | Endpoint | Function |
|---|---|---|
| GET | `/health` | Liveness check, no auth |
| POST | `/api/auth/token` | Trade `APP_ACCESS_KEY` for a JWT |
| GET | `/api/rooms/:deviceId/latest` | Latest reading for all parameters |
| GET | `/api/rooms/:deviceId/history?from=&to=` | Historical readings in a time range |
| GET | `/api/rooms/:deviceId/export?date=` | Daily aggregate for a given date |
| GET | `/api/rooms/:deviceId/status` | Normal/not-normal status per parameter |
| GET | `/api/rooms/:deviceId/prediction` | Latest composite-status result from the BiGRU classifier (`services/ml.js`); `{ available: false }` (not a 404) until a full 60-reading window is complete |

WebSocket clients connect to `ws://<host>:<port>/ws` and receive a
`{ type: "sensor_reading", reading, alerts }` message every time a new
reading is stored, and a `{ type: "prediction", prediction }` message
whenever a new composite-status prediction is computed (same payload
shape as the `/prediction` REST response above).

## Known placeholders (update before relying on this for the real demo)

- `routes/auth.js` / `APP_ACCESS_KEY` - a single shared secret stands in
  for real per-user login until role/permission design is finalized
  (`../prd.md` section 9).
- `services/ws.js` - the `/ws` WebSocket endpoint has no auth check at all
  (unlike the REST routes, which require the JWT from `/api/auth/token`).
  Anyone who can reach the backend's port can listen to every broadcast
  reading. Acceptable for skripsi-scale bench testing, not for a real
  deployment - revisit alongside the auth design in `prd.md` section 9.
- The single HiveMQ Cloud credential (shared with the firmware, see
  `firmware/include/secrets.h`) needs "Publish and Subscribe" permission
  on `hospital/#` in HiveMQ Cloud's Access Management - "Publish only" is
  enough for the device but leaves the backend's subscribe silently
  rejected (`services/mqtt.js` logs `subscribe failed ... Unspecified
  error` when this happens).
- Push notification (FCM) is not implemented - `services/mqtt.js` only
  logs new alerts to the console. No Firebase project/credentials exist
  yet (`../architecture.md` section 6.3).
- `services/db.js` connects to Supabase with `rejectUnauthorized: false`
  (TLS encrypted, certificate chain not pinned) - same trade-off as the
  firmware's MQTT connection, revisit before a real deployment.
- `sql/seed.sql` does not seed `thresholds` rows - normal ranges depend on
  a standard reference (Kemenkes/WHO/ASHRAE) not yet chosen
  (`../prd.md` section 8). Until rows exist, no alerts will ever fire.
- Data retention policy is not implemented - all readings are kept
  indefinitely (`../architecture.md` section 5, still an open question).
- `/api/rooms/:deviceId/export` returns a JSON aggregate; the actual
  export file format (CSV/PDF) is still open (`../prd.md` section 9).
- `services/ml.js` / `/api/rooms/:deviceId/prediction` require the CO2,
  lux, temperature, and humidity sensors to actually be reporting data -
  as of this writing they're physically uninstalled on the device
  (hardware repair), so every `sensor_readings` row is missing those
  columns and the prediction step keeps skipping by design (fail-safe,
  see `services/ml.js`). No code change needed once the sensors are
  reinstalled - it starts producing predictions automatically. Also
  requires `ml-service/` running and reachable at `ML_SERVICE_URL`
  (defaults to `http://127.0.0.1:8001`, see `src/config.js`).
