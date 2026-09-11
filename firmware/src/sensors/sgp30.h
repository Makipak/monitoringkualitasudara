#ifndef SENSORS_SGP30_H
#define SENSORS_SGP30_H

bool sgp30Init();

// Must be called every loop() iteration (non-blocking); internally
// rate-limited to 1Hz to satisfy SGP30's required constant sampling
// interval for its dynamic baseline algorithm. Calling IAQmeasure() at
// any other interval prevents the baseline from converging, causing
// TVOC to spike then drop back to 0 — this fixes that exact symptom.
void sgp30Update();

// Returns the most recent TVOC reading captured by sgp30Update().
bool sgp30Read(float &tvocPpbOut);

// Feeds ambient temperature/humidity (from GY-SHT31, see sht31.h) into
// SGP30's absolute-humidity compensation input so its internal dynamic
// baseline corrects for humidity swings instead of misreading them as TVOC
// changes (Sensirion SGP30 datasheet, humidity compensation section).
// Ported from the ESP32-S3 bring-up sketch — call once per sensorsRead()
// cycle right after a successful sht31Read(), before sgp30Read() (see
// sensors.cpp); harmless to skip on a cycle sht31Read() fails, SGP30 just
// keeps using its last compensation value.
void sgp30SetHumidity(float temperatureC, float humidityPct);

#endif // SENSORS_SGP30_H