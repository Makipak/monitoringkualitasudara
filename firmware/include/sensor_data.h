#ifndef SENSOR_DATA_H
#define SENSOR_DATA_H

// Single struct passed between sensors/ -> main.cpp -> display/ + network/,
// so each layer only depends on this shape, not on individual sensor
// libraries (rule.md 3: single responsibility per module).
struct SensorReadings {
  float pm25 = 0;
  float pm10 = 0;
  float no2 = 0;
  float co2 = 0;
  float tvoc = 0;
  float lux = 0;
  float noiseDb = 0;

  // Per-parameter read success, in the same order as thresholds.h /
  // LED_PINS[0..6]. A sensor that fails to respond keeps its last good
  // value in the fields above but is marked invalid here so display/
  // and network/ can decide whether to show/publish it.
  bool valid[7] = {false, false, false, false, false, false, false};

  // Room temperature (GY-SHT31, degrees C) — display-only info per
  // architecture.md 2.1 "Catatan suhu ruangan": deliberately NOT one of
  // the 7 official parameters, so it must never be added to `valid[]`,
  // never published over MQTT (see mqtt_pub.cpp), never persisted, and
  // never evaluated against thresholds.h. Promote it properly (new
  // SensorIndex slot + prd.md/schema.md update) if it becomes official.
  float roomTempC = 0;
  bool roomTempValid = false;
};

enum SensorIndex {
  SENSOR_PM25 = 0,
  SENSOR_PM10 = 1,
  SENSOR_NO2 = 2,
  SENSOR_CO2 = 3,
  SENSOR_TVOC = 4,
  SENSOR_LUX = 5,
  SENSOR_NOISE = 6,
};

#endif // SENSOR_DATA_H
