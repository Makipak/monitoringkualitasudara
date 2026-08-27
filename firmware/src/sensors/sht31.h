#ifndef SENSORS_SHT31_H
#define SENSORS_SHT31_H

// Room temperature + humidity via GY-SHT31, I2C (default address 0x44).
// Added per architecture.md 2.1 "Catatan suhu ruangan" / schema.md 3.4:
// both ARE published over MQTT and persisted like the 7 official
// parameters, but deliberately excluded from thresholds.h evaluation
// and the on-screen status label/alerts. See the warning comment on
// SensorReadings::roomTempC/roomHumidityPct in include/sensor_data.h
// before wiring either into the threshold path.

bool sht31Init();

// Single combined read (one I2C round trip via the library's
// readBoth()) so temperature and humidity always share one validity
// flag - they're physically one measurement, not two independent ones.
bool sht31Read(float &tempCOut, float &humidityPctOut);

#endif // SENSORS_SHT31_H
