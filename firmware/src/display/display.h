#ifndef DISPLAY_DISPLAY_H
#define DISPLAY_DISPLAY_H

#include "../../include/sensor_data.h"

void displayInit();

// Renders all 7 parameters + connectivity status. Pure presentation —
// does not touch sensors or network state directly (rule.md 3: keep
// sensor-read and display logic in separate functions/files).
void displayShowReadings(const SensorReadings &readings, bool wifiConnected,
                          bool mqttConnected);

#endif // DISPLAY_DISPLAY_H
