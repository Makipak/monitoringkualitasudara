#ifndef SENSORS_SGP30_H
#define SENSORS_SGP30_H

// TVOC (and eCO2, unused — SCD30 already covers CO2) via Sensirion SGP30,
// I2C. Library: adafruit/Adafruit SGP30 Sensor.
//
// Note: SGP30 needs ~15s of warm-up plus periodic calls (roughly every 1s)
// to its internal baseline algorithm to produce accurate readings. Calling
// sgp30Read() only once per SENSOR_READ_INTERVAL_MS (config.h) is fine for
// display purposes but means the very first values after boot are rough
// estimates — call out this behavior if TVOC accuracy matters for
// thresholds validation later.

bool sgp30Init();

bool sgp30Read(float &tvocPpbOut);

#endif // SENSORS_SGP30_H
