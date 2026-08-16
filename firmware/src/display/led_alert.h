#ifndef DISPLAY_LED_ALERT_H
#define DISPLAY_LED_ALERT_H

#include "../../include/sensor_data.h"

void ledAlertInit();

// Evaluates each parameter against thresholds.h and drives its LED
// directly — this is the "works even if internet is down" indicator
// path described in architecture.md 2.2, independent from the
// server-side evaluation in the backend (schema.md `thresholds` /
// `alerts` tables).
void ledAlertUpdate(const SensorReadings &readings);

#endif // DISPLAY_LED_ALERT_H
