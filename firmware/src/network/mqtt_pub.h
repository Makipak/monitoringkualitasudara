#ifndef NETWORK_MQTT_PUB_H
#define NETWORK_MQTT_PUB_H

#include "../../include/sensor_data.h"

// Owns the single MQTT connection (PubSubClient) to HiveMQ Cloud in both
// directions — publishing sensor readings and subscribing to the
// composite-status prediction the backend publishes back. This stays one
// module (not split into pub/sub files) because PubSubClient is
// fundamentally one client/one TLS connection either way; the shared
// responsibility is genuinely "own the MQTT connection to the broker",
// not two unrelated jobs (rule.md 3).
void mqttInit();

// Non-blocking: attempts reconnect if needed (bounded by
// MQTT_RECONNECT_INTERVAL_MS), (re)subscribes to the prediction topic
// after every successful (re)connect, and services the PubSubClient loop
// (which also delivers subscribed messages via the callback registered in
// mqttInit()). Call every loop() iteration, same as wifiMaintain().
void mqttMaintain();

bool mqttIsConnected();

// Serializes `readings` to the JSON payload shape from architecture.md
// 2.3 and publishes to `hospital/{DEVICE_ID}/sensors`. No-op (returns
// false) if not connected. Logs the outcome to Serial itself (connect
// state, publish success/failure) since the display's WiFi/MQTT status
// row is laid out for the final ST7796 panel and is off-screen on the
// temporary bench-test display (see display.cpp).
bool mqttPublishReadings(const SensorReadings &readings);

// Latest composite-status prediction received from the backend over MQTT
// (topic hospital/{DEVICE_ID}/prediction, published retained — see
// backend/src/services/mqtt.js). `available` is false until the first
// message arrives after boot/reconnect; there is no on-device
// fallback/guess (see sensor_data.h's PredictionState comment).
const PredictionState &mqttGetPrediction();

#endif // NETWORK_MQTT_PUB_H
