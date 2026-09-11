#include "sgp30.h"

#include <Adafruit_SGP30.h>
#include <Arduino.h>
#include <math.h>

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

void sgp30SetHumidity(float temperatureC, float humidityPct) {
  // Sensirion's documented absolute-humidity formula (g/m3), scaled to the
  // fixed-point mg/m3 format Adafruit_SGP30::setHumidity() expects — same
  // formula Adafruit's own SGP30 humidity-compensation example uses, and
  // copied byte-for-byte (down to using double-precision exp(), not
  // expf()) from the Arduino IDE bring-up sketch's getAbsoluteHumidity().
  const float absoluteHumidityGm3 =
      216.7f * ((humidityPct / 100.0f) * 6.112f *
                exp((17.62f * temperatureC) / (243.12f + temperatureC)) /
                (273.15f + temperatureC));
  sgp.setHumidity(static_cast<uint32_t>(1000.0f * absoluteHumidityGm3));
}