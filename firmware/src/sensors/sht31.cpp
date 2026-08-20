#include "sht31.h"

#include <Adafruit_SHT31.h>

namespace {
Adafruit_SHT31 sht31;
constexpr uint8_t SHT31_I2C_ADDR = 0x44; // default address, no conflict
                                          // with SGP30/MiCS-4514/BH1750
}

bool sht31Init() { return sht31.begin(SHT31_I2C_ADDR); }

bool sht31Read(float &tempCOut) {
  float temp = sht31.readTemperature();
  if (isnan(temp)) {
    return false;
  }
  tempCOut = temp;
  return true;
}
