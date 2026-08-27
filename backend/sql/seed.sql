-- Seed for v1 (1 device / 1 room). "room-01" must match DEVICE_ID in
-- firmware/include/config.h - that's the value the firmware publishes as
-- MQTT topic `hospital/room-01/sensors` and JSON field `device_id`; the
-- backend's mqtt.js looks up this row to resolve it to devices.id.
--
-- Safe to re-run: guarded on devices.device_id, which is UNIQUE
-- (schema.md 3.2), so a second run inserts nothing.
WITH inserted_room AS (
  INSERT INTO rooms (name, location)
  SELECT 'Ruang Perawatan A', NULL
  WHERE NOT EXISTS (SELECT 1 FROM devices WHERE device_id = 'room-01')
  RETURNING id
)
INSERT INTO devices (device_id, room_id)
SELECT 'room-01', id FROM inserted_room;

-- Threshold rows (schema.md 3.4) are intentionally NOT seeded here - final
-- normal ranges depend on the Kemenkes/WHO/ASHRAE reference the team
-- hasn't picked yet (prd.md section 8, "Open Questions"). Insert real rows
-- once decided, one per official parameter, e.g.:
--
--   INSERT INTO thresholds (parameter, min_value, max_value, reference)
--   VALUES ('pm25', 0, 35, 'Kemenkes No. X Tahun Y');
--
-- Until then, src/services/threshold.js has nothing to compare a
-- parameter against and simply skips it (no alert raised) - fails safe,
-- not fails loud.
