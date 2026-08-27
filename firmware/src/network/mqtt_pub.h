#ifndef NETWORK_MQTT_PUB_H
#define NETWORK_MQTT_PUB_H

#include "../../include/sensor_data.h"

void mqttInit();

// Non-blocking: attempts reconnect if needed (bounded by
// MQTT_RECONNECT_INTERVAL_MS) and services the PubSubClient loop. Call
// every loop() iteration, same as wifiMaintain().
void mqttMaintain();

bool mqttIsConnected();

// Serializes `readings` to the JSON payload shape from architecture.md
// 2.3 and publishes to `hospital/{DEVICE_ID}/sensors`. No-op (returns
// false) if not connected. Logs the outcome to Serial itself (connect
// state, publish success/failure) since the display's WiFi/MQTT status
// row is laid out for the final ST7796 panel and is off-screen on the
// temporary bench-test display (see display.cpp).
bool mqttPublishReadings(const SensorReadings &readings);

#endif // NETWORK_MQTT_PUB_H
