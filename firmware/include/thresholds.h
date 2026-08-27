#ifndef THRESHOLDS_H
#define THRESHOLDS_H

// ---------------------------------------------------------------------------
// Local (device-side) normal ranges — drives the on-screen Normal/Tidak
// Normal label (display.cpp) so the device can still flag an out-of-range
// parameter even when it's offline from the broker (architecture.md 2.2).
// This is intentionally separate from the server-side `thresholds` table
// (schema.md 3.4), which is the source of truth for history/notifications
// and can be tuned without reflashing firmware.
//
// PLACEHOLDER VALUES — replace once the official reference (Kemenkes/WHO/
// ASHRAE, see prd.md section 8) is finalized. Keeping them in one place
// (rule.md 5) so that update is a one-file change.
//
// Deliberately 7 entries, not 8: room temperature (GY-SHT31) is published
// and stored (architecture.md 2.1 / schema.md 3.3) but explicitly
// excluded from threshold evaluation — do not add a "temperature" row
// here without first updating prd.md (new FR) and schema.md 3.4.
// ---------------------------------------------------------------------------

struct Threshold {
  const char *parameter;
  float minValue; // NAN if no lower bound
  float maxValue;
};

constexpr int NUM_THRESHOLDS = 7;

// Order matches SensorIndex in sensor_data.h (0..6) — keep in sync.
constexpr Threshold THRESHOLDS[NUM_THRESHOLDS] = {
    {"pm25", 0.0f, 35.0f},      // ug/m3, placeholder (WHO 24h guideline ~15)
    {"pm10", 0.0f, 70.0f},      // ug/m3, placeholder
    {"no2", 0.0f, 0.1f},        // ppm, placeholder
    {"co2", 0.0f, 1000.0f},     // ppm, placeholder (indoor comfort threshold)
    {"tvoc", 0.0f, 500.0f},     // ppb, placeholder
    {"lux", 100.0f, 1000.0f},   // lux, placeholder (patient room comfort range)
    {"noise_db", 0.0f, 55.0f},  // dB, placeholder (hospital ward guideline)
};

// Used by display.cpp to draw the Normal/Tidak Normal label on the TFT —
// index is into THRESHOLDS[], 0..6 (SensorIndex in sensor_data.h).
// Out-of-bounds index fails safe (false, no alert) rather than reading
// past the array.
inline bool thresholdOutOfRange(int index, float value) {
  if (index < 0 || index >= NUM_THRESHOLDS) return false;
  const Threshold &t = THRESHOLDS[index];
  return value < t.minValue || value > t.maxValue;
}

#endif // THRESHOLDS_H
