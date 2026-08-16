#ifndef THRESHOLDS_H
#define THRESHOLDS_H

// ---------------------------------------------------------------------------
// Local (device-side) normal ranges — drives the instant red-LED indicator
// so it keeps working even when the device is offline from the broker
// (architecture.md 2.2). This is intentionally separate from the
// server-side `thresholds` table (schema.md 3.4), which is the source of
// truth for history/notifications and can be tuned without reflashing
// firmware.
//
// PLACEHOLDER VALUES — replace once the official reference (Kemenkes/WHO/
// ASHRAE, see prd.md section 8) is finalized. Keeping them in one place
// (rule.md 5) so that update is a one-file change.
// ---------------------------------------------------------------------------

struct Threshold {
  const char *parameter;
  float minValue; // NAN if no lower bound
  float maxValue;
};

constexpr int NUM_THRESHOLDS = 7;

// Order matches LED_PINS[0..6] in config.h — keep in sync.
constexpr Threshold THRESHOLDS[NUM_THRESHOLDS] = {
    {"pm25", 0.0f, 35.0f},      // ug/m3, placeholder (WHO 24h guideline ~15)
    {"pm10", 0.0f, 70.0f},      // ug/m3, placeholder
    {"no2", 0.0f, 0.1f},        // ppm, placeholder
    {"co2", 0.0f, 1000.0f},     // ppm, placeholder (indoor comfort threshold)
    {"tvoc", 0.0f, 500.0f},     // ppb, placeholder
    {"lux", 100.0f, 1000.0f},   // lux, placeholder (patient room comfort range)
    {"noise_db", 0.0f, 55.0f},  // dB, placeholder (hospital ward guideline)
};

#endif // THRESHOLDS_H
