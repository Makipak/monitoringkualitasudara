#ifndef SENSORS_H
#define SENSORS_H

#include "../../include/sensor_data.h"

// Initializes I2C bus + all 6 sensor drivers. Call once from setup().
void sensorsInit();

// Reads whatever is ready from each sensor into `readings`, updating
// readings.valid[] per-parameter. Non-blocking beyond each driver's own
// short internal wait; call on a fixed interval from loop() (see
// SENSOR_READ_INTERVAL_MS in config.h).
void sensorsRead(SensorReadings &readings);

#endif // SENSORS_H
