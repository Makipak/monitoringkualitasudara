#include "led_alert.h"

#include <Arduino.h>

#include "../../include/config.h"
#include "../../include/thresholds.h"

void ledAlertInit() {
  for (uint8_t i = 0; i < NUM_LEDS; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
}

namespace {
bool getValue(const SensorReadings &r, int index, float &outValue,
              bool &outValid) {
  switch (index) {
    case SENSOR_PM25: outValue = r.pm25; outValid = r.valid[SENSOR_PM25]; return true;
    case SENSOR_PM10: outValue = r.pm10; outValid = r.valid[SENSOR_PM10]; return true;
    case SENSOR_NO2: outValue = r.no2; outValid = r.valid[SENSOR_NO2]; return true;
    case SENSOR_CO2: outValue = r.co2; outValid = r.valid[SENSOR_CO2]; return true;
    case SENSOR_TVOC: outValue = r.tvoc; outValid = r.valid[SENSOR_TVOC]; return true;
    case SENSOR_LUX: outValue = r.lux; outValid = r.valid[SENSOR_LUX]; return true;
    case SENSOR_NOISE: outValue = r.noiseDb; outValid = r.valid[SENSOR_NOISE]; return true;
    default: return false;
  }
}
} // namespace

void ledAlertUpdate(const SensorReadings &readings) {
  for (uint8_t i = 0; i < NUM_LEDS && i < NUM_THRESHOLDS; i++) {
    float value = 0;
    bool valid = false;
    if (!getValue(readings, i, value, valid) || !valid) {
      digitalWrite(LED_PINS[i], LOW); // no data yet -> no false alert
      continue;
    }

    const Threshold &t = THRESHOLDS[i];
    bool outOfRange = value < t.minValue || value > t.maxValue;
    digitalWrite(LED_PINS[i], outOfRange ? HIGH : LOW);
  }
}
