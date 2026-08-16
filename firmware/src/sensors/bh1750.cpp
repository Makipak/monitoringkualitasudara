#include "bh1750.h"

#include <BH1750.h>

namespace {
BH1750 lightMeter;
}

bool bh1750SensorInit() {
  return lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
}

bool bh1750Read(float &luxOut) {
  if (!lightMeter.measurementReady()) {
    return false;
  }
  luxOut = lightMeter.readLightLevel();
  return luxOut >= 0; // library returns -1 on read error
}
