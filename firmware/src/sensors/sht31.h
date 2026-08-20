#ifndef SENSORS_SHT31_H
#define SENSORS_SHT31_H

// Room temperature via GY-SHT31, I2C (default address 0x44). Added per
// architecture.md 2.1 "Catatan suhu ruangan" as a DISPLAY-ONLY value —
// deliberately not one of the 7 official parameters: not published to
// MQTT, not persisted, not evaluated against thresholds.h. See the
// warning comment on SensorReadings::roomTempC in include/sensor_data.h
// before wiring this into any of those paths.

bool sht31Init();

bool sht31Read(float &tempCOut);

#endif // SENSORS_SHT31_H
