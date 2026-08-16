#include "sensors.h"

#include <Wire.h>

#include "../../include/config.h"
#include "bh1750.h"
#include "mic_noise.h"
#include "mics4514.h"
#include "pms5003.h"
#include "scd30.h"
#include "sgp30.h"

void sensorsInit() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  pms5003Init();
  scd30Init();
  sgp30Init();
  mics4514Init();
  bh1750SensorInit();
  micNoiseInit();
}

void sensorsRead(SensorReadings &readings) {
  readings.valid[SENSOR_PM25] = readings.valid[SENSOR_PM10] =
      pms5003Read(readings.pm25, readings.pm10);

  readings.valid[SENSOR_CO2] = scd30Read(readings.co2);
  readings.valid[SENSOR_TVOC] = sgp30Read(readings.tvoc);
  readings.valid[SENSOR_NO2] = mics4514Read(readings.no2);
  readings.valid[SENSOR_LUX] = bh1750Read(readings.lux);

  // Mic has no "ready" concept — always produces a value synchronously.
  readings.noiseDb = micNoiseRead();
  readings.valid[SENSOR_NOISE] = true;
}
