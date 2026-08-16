#include "sgp30.h"

#include <Adafruit_SGP30.h>

namespace {
Adafruit_SGP30 sgp;
}

bool sgp30Init() { return sgp.begin(); }

bool sgp30Read(float &tvocPpbOut) {
  if (!sgp.IAQmeasure()) {
    return false;
  }
  tvocPpbOut = static_cast<float>(sgp.TVOC);
  return true;
}
