#include <Arduino.h>

#include "../include/config.h"
#include "../include/sensor_data.h"
#include "display/display.h"
#include "network/mqtt_pub.h"
#include "network/wifi_conn.h"
#include "sensors/sensors.h"

namespace {
SensorReadings readings;
unsigned long lastSensorReadMs = 0;
} // namespace

void setup() {
  Serial.begin(115200);

  sensorsInit();
  displayInit();
  wifiInit();
  mqttInit();
}

void loop() {
  wifiMaintain();
  mqttMaintain();
  sensorsMaintain();

  unsigned long now = millis();

  if (now - lastSensorReadMs >= SENSOR_READ_INTERVAL_MS) {
    lastSensorReadMs = now;

    sensorsRead(readings);

    // Out-of-range parameters are surfaced via the on-screen Normal/Tidak
    // Normal label (display.cpp) — no physical LED indicator (removed,
    // see prd.md/architecture.md history; was firmware/src/display/led_alert.*).
    displayShowReadings(readings, wifiIsConnected(), mqttIsConnected());
    // Publish on the same tick as the display refresh (see config.h
    // SENSOR_READ_INTERVAL_MS comment) so the app is never showing a
    // value older than what's on the device's own screen.
    mqttPublishReadings(readings);
  }
}
