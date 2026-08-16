#include "scd30.h"

#include <SensirionI2cScd30.h>
#include <Wire.h>

namespace {
SensirionI2cScd30 scd30;
}

bool scd30Init() {
  scd30.begin(Wire, SCD30_I2C_ADDR_61);
  uint16_t error = scd30.startPeriodicMeasurement(0 /* default ambient pressure */);
  return error == 0;
}

bool scd30Read(float &co2PpmOut) {
  bool dataReady = false;
  if (scd30.getDataReady(dataReady) != 0 || !dataReady) {
    return false;
  }

  float co2 = 0, temperature = 0, humidity = 0;
  if (scd30.readMeasurementData(co2, temperature, humidity) != 0) {
    return false;
  }

  co2PpmOut = co2;
  return true;
}
