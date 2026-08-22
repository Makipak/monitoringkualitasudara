#ifndef SENSORS_SHT31_H
#define SENSORS_SHT31_H

// Room temperature via GY-SHT31, I2C (default address 0x44). Added per
// architecture.md 2.1 "Catatan suhu ruangan" / schema.md 3.4: IS
// published over MQTT and persisted like the 7 official parameters, but
// deliberately excluded from thresholds.h evaluation and LED/alerts. See
// the warning comment on SensorReadings::roomTempC in
// include/sensor_data.h before wiring this into the threshold path.

bool sht31Init();

bool sht31Read(float &tempCOut);

#endif // SENSORS_SHT31_H
