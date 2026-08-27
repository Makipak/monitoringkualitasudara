-- PostgreSQL schema for the Udara backend (source of truth: ../../schema.md).
-- Run once against the Supabase project (SQL editor or `psql "$DATABASE_URL"
-- -f sql/schema.sql`), then sql/seed.sql for the v1 single-device setup.

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  room_id UUID NOT NULL REFERENCES rooms(id),
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  device_id UUID NOT NULL REFERENCES devices(id),
  pm25 DOUBLE PRECISION,
  pm10 DOUBLE PRECISION,
  no2 DOUBLE PRECISION,
  co2 DOUBLE PRECISION,
  tvoc DOUBLE PRECISION,
  lux DOUBLE PRECISION,
  noise_db DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION
);

-- If this schema was already applied to a live Supabase project before
-- `humidity` was added, this CREATE TABLE won't touch the existing
-- table - run this once against it instead:
--   ALTER TABLE sensor_readings ADD COLUMN humidity DOUBLE PRECISION;

-- Index utama untuk query histori per device, terurut waktu terbaru
CREATE INDEX idx_sensor_readings_device_time
  ON sensor_readings (device_id, time DESC);

-- Index tambahan untuk query lintas device berdasarkan rentang waktu (misal export harian)
CREATE INDEX idx_sensor_readings_time
  ON sensor_readings (time DESC);

CREATE TABLE thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter TEXT NOT NULL UNIQUE,
  min_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  reference TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  parameter TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  threshold_id UUID REFERENCES thresholds(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_device_triggered
  ON alerts (device_id, triggered_at DESC);

-- Composite status from the BiGRU classifier (schema.md 3.6, ml-service/).
-- Separate from `alerts`, which stays the rule-based source of truth for
-- notifications (architecture.md 4.2a) - this table is additive.
--
-- New as of this migration - if schema.sql was already applied to a live
-- Supabase project before this table existed, run just this CREATE TABLE
-- + its index against it (same situation as the humidity column note
-- above).
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  time TIMESTAMPTZ NOT NULL DEFAULT now(),
  label TEXT NOT NULL,
  class_index INTEGER NOT NULL,
  probabilities JSONB NOT NULL,
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_predictions_device_time
  ON predictions (device_id, time DESC);

CREATE TABLE device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fcm_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase auto-exposes every public table over PostgREST to anyone
-- holding the project's anon key. This backend never uses that path (it
-- connects with the `postgres` role via DATABASE_URL, which owns these
-- tables and bypasses RLS), so RLS is enabled here with no policies -
-- default-deny for PostgREST/anon, no effect on the backend itself.
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;
