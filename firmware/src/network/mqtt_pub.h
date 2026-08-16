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
// false) if not connected — caller decides whether/how to log this.
bool mqttPublishReadings(const SensorReadings &readings);

#endif // NETWORK_MQTT_PUB_H
