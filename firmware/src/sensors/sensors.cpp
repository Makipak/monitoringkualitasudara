#include "sensors.h"

#include <Wire.h>

#include "../../include/config.h"
#include "bh1750.h"
#include "mhz19.h"
#include "mic_noise.h"
#include "mics4514.h"
#include "sds011.h"
#include "sgp30.h"
#include "sht31.h"

void sensorsInit() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  sds011Init();
  mhz19Init();
  sgp30Init();
  mics4514Init();
  bh1750SensorInit();
  micNoiseInit();
  sht31Init();
}

void sensorsRead(SensorReadings &readings) {
  readings.valid[SENSOR_PM25] = readings.valid[SENSOR_PM10] =
      sds011Read(readings.pm25, readings.pm10);

  readings.valid[SENSOR_CO2] = mhz19Read(readings.co2);
  readings.valid[SENSOR_TVOC] = sgp30Read(readings.tvoc);
  readings.valid[SENSOR_NO2] = mics4514Read(readings.no2);
  readings.valid[SENSOR_LUX] = bh1750Read(readings.lux);

  // Mic has no "ready" concept — always produces a value synchronously.
  readings.noiseDb = micNoiseRead();
  readings.valid[SENSOR_NOISE] = true;

  // Display-only — deliberately not part of valid[] (see
  // include/sensor_data.h warning comment on roomTempC).
  readings.roomTempValid = sht31Read(readings.roomTempC);
}
