#ifndef SENSORS_H
#define SENSORS_H

#include "../../include/sensor_data.h"

// Initializes I2C bus + all 6 official-parameter sensor drivers (SDS011,
// MH-Z19B, SGP30, MiCS-4514, BH1750, MAX9814) plus GY-SHT31 (room temp,
// published/stored but not threshold-evaluated). Call once from setup().
void sensorsInit();

// Reads whatever is ready from each sensor into `readings`, updating
// readings.valid[] per-parameter (and readings.roomTempValid for the
// non-official temperature reading). Non-blocking beyond each driver's
// own short internal wait; call on a fixed interval from loop() (see
// SENSOR_READ_INTERVAL_MS in config.h).
void sensorsRead(SensorReadings &readings);

#endif // SENSORS_H
