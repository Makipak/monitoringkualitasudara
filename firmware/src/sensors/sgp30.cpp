#include "sgp30.h"

#include <Adafruit_SGP30.h>
#include <Arduino.h>

namespace {
Adafruit_SGP30 sgp;
constexpr unsigned long SGP30_UPDATE_INTERVAL_MS = 1000;
unsigned long lastUpdateMs = 0;
float lastTvocPpb = 0.0f;
bool hasValidReading = false;
} // namespace

bool sgp30Init() { return sgp.begin(); }

void sgp30Update() {
  unsigned long now = millis();
  if (now - lastUpdateMs < SGP30_UPDATE_INTERVAL_MS) {
    return;
  }
  lastUpdateMs = now;

  if (sgp.IAQmeasure()) {
    lastTvocPpb = static_cast<float>(sgp.TVOC);
    hasValidReading = true;
  }
}

bool sgp30Read(float &tvocPpbOut) {
  if (!hasValidReading) {
    return false;
  }
  tvocPpbOut = lastTvocPpb;
  return true;
}