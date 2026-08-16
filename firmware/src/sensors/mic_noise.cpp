#include "mic_noise.h"

#include <Arduino.h>
#include <math.h>

#include "../../include/config.h"

namespace {
constexpr unsigned long SAMPLE_WINDOW_MS = 50; // one envelope sweep
constexpr float ADC_MAX = 4095.0f;              // ESP32 12-bit ADC
constexpr float ADC_REF_VOLTAGE = 3.3f;

// Placeholder calibration — MAX9814 output needs a reference SPL meter to
// derive real dB(SPL) offset/slope for your specific mic + gain setting.
// Until calibrated, treat noiseDb as "relative loudness", not an absolute
// hospital-grade SPL reading.
constexpr float CALIBRATION_OFFSET_DB = 30.0f;
} // namespace

void micNoiseInit() {
  analogReadResolution(12);
}

float micNoiseRead() {
  unsigned long startMs = millis();
  uint16_t peakToPeak = 0;
  uint16_t sampleMin = 4095;
  uint16_t sampleMax = 0;

  while (millis() - startMs < SAMPLE_WINDOW_MS) {
    uint16_t sample = analogRead(PIN_MIC_ANALOG);
    if (sample < sampleMin) sampleMin = sample;
    if (sample > sampleMax) sampleMax = sample;
  }
  peakToPeak = sampleMax - sampleMin;

  float voltage = (peakToPeak * ADC_REF_VOLTAGE) / ADC_MAX;
  // Rough log conversion so louder sound reads as a higher "dB-like" value.
  // Guard against log10(0) when the room is silent.
  float db = 20.0f * log10f(voltage > 0.001f ? voltage : 0.001f) +
             CALIBRATION_OFFSET_DB;
  return db < 0 ? 0 : db;
}
