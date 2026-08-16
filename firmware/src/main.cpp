#include <Arduino.h>

#include "../include/config.h"
#include "../include/sensor_data.h"
#include "display/display.h"
#include "display/led_alert.h"
#include "network/mqtt_pub.h"
#include "network/wifi_conn.h"
#include "sensors/sensors.h"

namespace {
SensorReadings readings;
unsigned long lastSensorReadMs = 0;
unsigned long lastMqttPublishMs = 0;
} // namespace

void setup() {
  Serial.begin(115200);

  sensorsInit();
  displayInit();
  ledAlertInit();
  wifiInit();
  mqttInit();
}

void loop() {
  // Connectivity is maintained opportunistically every iteration; both
  // functions are internally rate-limited (see WIFI_/MQTT_RECONNECT_
  // INTERVAL_MS in config.h) so this loop stays non-blocking.
  wifiMaintain();
  mqttMaintain();

  unsigned long now = millis();

  if (now - lastSensorReadMs >= SENSOR_READ_INTERVAL_MS) {
    lastSensorReadMs = now;

    sensorsRead(readings);

    // LED alert is evaluated locally on every read so it keeps working
    // even when WiFi/MQTT is down (architecture.md 2.2).
    ledAlertUpdate(readings);
    displayShowReadings(readings, wifiIsConnected(), mqttIsConnected());
  }

  if (now - lastMqttPublishMs >= MQTT_PUBLISH_INTERVAL_MS) {
    lastMqttPublishMs = now;
    mqttPublishReadings(readings);
  }
}
