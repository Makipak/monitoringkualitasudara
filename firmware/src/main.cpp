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

    // Out-of-range parameters are surfaced via color-coded values
    // (display.cpp) — no physical LED indicator (removed, see prd.md/
    // architecture.md history; was firmware/src/display/led_alert.*).
    // mqttGetPrediction() is just the latest cached value from the last
    // MQTT message (see network/mqtt_pub.cpp) — this call never blocks
    // on the network.
    displayShowReadings(readings, wifiIsConnected(), mqttIsConnected(),
                         mqttGetPrediction());
    // Publish on the same tick as the display refresh (see config.h
    // SENSOR_READ_INTERVAL_MS comment) so the app is never showing a
    // value older than what's on the device's own screen.
    mqttPublishReadings(readings);
  }
}
