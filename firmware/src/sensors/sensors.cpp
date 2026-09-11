#include "sensors.h"

#include <Wire.h>

#include "../../include/config.h"
#include "bh1750.h"
#include "mic_noise.h"
#include "mhz19c.h"
#include "mics4514.h"
#include "sds011.h"
#include "sgp30.h"
#include "sht31.h"

void sensorsInit() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(100000);

#if CONFIG_IDF_TARGET_ESP32S3
  // Dedicated second I2C bus for MiCS-4514 on the ESP32-S3 target only —
  // see config.h's PIN_MICS_SDA/PIN_MICS_SCL comment and
  // sensors/mics4514.cpp for why. mics4514Init() below talks on this bus
  // automatically (mics4514.cpp picks Wire1 vs Wire via
  // CONFIG_IDF_TARGET_ESP32S3, same as here).
  Wire1.begin(PIN_MICS_SDA, PIN_MICS_SCL);
  Wire1.setClock(100000);
#endif

  sds011Init();
  mhz19cInit();
  sgp30Init();
  mics4514Init();
  bh1750SensorInit();
  micNoiseInit();
  sht31Init();
}

void sensorsRead(SensorReadings &readings) {
  // Read room temp/humidity first (display-only — deliberately not part
  // of valid[], see include/sensor_data.h warning comment on
  // roomTempC/roomHumidityPct) so a fresh value is available to feed
  // SGP30's humidity compensation before its own read below.
  readings.sht31Valid = sht31Read(readings.roomTempC, readings.roomHumidityPct);
  if (readings.sht31Valid) {
    sgp30SetHumidity(readings.roomTempC, readings.roomHumidityPct);
  }

  readings.valid[SENSOR_PM25] = readings.valid[SENSOR_PM10] =
      sds011Read(readings.pm25, readings.pm10);

  readings.valid[SENSOR_CO2] = mhz19cRead(readings.co2);
  readings.valid[SENSOR_TVOC] = sgp30Read(readings.tvoc);
  readings.valid[SENSOR_NO2] = mics4514Read(readings.no2);
  readings.valid[SENSOR_LUX] = bh1750Read(readings.lux);

  // Mic has no "ready" concept — always produces a value synchronously.
  readings.noiseDb = micNoiseRead();
  readings.valid[SENSOR_NOISE] = true;
}

void sensorsMaintain() {
  sgp30Update();
}
