#ifndef DISPLAY_DISPLAY_H
#define DISPLAY_DISPLAY_H

#include "../../include/sensor_data.h"

void displayInit();

// Renders all 7 official parameters (each with a Normal/Tidak Normal label
// evaluated against thresholds.h — the device's only out-of-range
// indicator now, there is no LED), room temperature + humidity (no status
// label — schema.md 3.4 excludes both from threshold evaluation), and
// connectivity status. Pure presentation — does not touch sensors or
// network state directly (rule.md 3: keep sensor-read and display logic
// in separate functions/files).
void displayShowReadings(const SensorReadings &readings, bool wifiConnected,
                          bool mqttConnected);

#endif // DISPLAY_DISPLAY_H
