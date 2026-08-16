#include "mqtt_pub.h"

#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

#include "../../include/config.h"
#include "../../include/secrets.h"
#include "wifi_conn.h"

namespace {
WiFiClientSecure tlsClient;
PubSubClient mqttClient(tlsClient);
unsigned long lastAttemptMs = 0;

char topicBuffer[64];

void buildTopic() {
  snprintf(topicBuffer, sizeof(topicBuffer), "hospital/%s/sensors", DEVICE_ID);
}
} // namespace

void mqttInit() {
  // NOTE (security trade-off, see rule.md 6 + architecture.md 7): TLS is
  // enforced by connecting on port 8883, but this uses setInsecure() —
  // i.e. it does NOT verify HiveMQ Cloud's server certificate chain, only
  // encrypts the transport. That's an acceptable shortcut to get MQTT
  // working during firmware bring-up, but before the actual sidang/demo
  // deployment, pin HiveMQ's root CA with tlsClient.setCACert(...) so the
  // device can't be MITM'd on the WiFi network it joins.
  tlsClient.setInsecure();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  buildTopic();
}

void mqttMaintain() {
  if (!wifiIsConnected()) {
    return; // no point trying MQTT without WiFi
  }

  if (mqttClient.connected()) {
    mqttClient.loop();
    return;
  }

  unsigned long now = millis();
  if (now - lastAttemptMs < MQTT_RECONNECT_INTERVAL_MS) {
    return;
  }
  lastAttemptMs = now;

  mqttClient.connect(DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD);
}

bool mqttIsConnected() { return mqttClient.connected(); }

bool mqttPublishReadings(const SensorReadings &readings) {
  if (!mqttClient.connected()) {
    return false;
  }

  // Timestamp is intentionally omitted — architecture.md 2.4 notes the
  // backend assigns it on receipt since this device has no RTC module.
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  if (readings.valid[SENSOR_PM25]) doc["pm25"] = readings.pm25;
  if (readings.valid[SENSOR_PM10]) doc["pm10"] = readings.pm10;
  if (readings.valid[SENSOR_NO2]) doc["no2"] = readings.no2;
  if (readings.valid[SENSOR_CO2]) doc["co2"] = readings.co2;
  if (readings.valid[SENSOR_TVOC]) doc["tvoc"] = readings.tvoc;
  if (readings.valid[SENSOR_LUX]) doc["lux"] = readings.lux;
  if (readings.valid[SENSOR_NOISE]) doc["noise_db"] = readings.noiseDb;

  char payload[256];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  return mqttClient.publish(topicBuffer, reinterpret_cast<uint8_t *>(payload),
                             len, false);
}
