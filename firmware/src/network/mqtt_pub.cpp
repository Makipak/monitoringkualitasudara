#include "mqtt_pub.h"

#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <string.h>

#include "../../include/config.h"
#include "../../include/secrets.h"
#include "wifi_conn.h"

namespace {
WiFiClientSecure tlsClient;
PubSubClient mqttClient(tlsClient);
unsigned long lastAttemptMs = 0;
bool wasConnected = false; // edge-detect disconnected -> connected, same
                           // pattern as wifi_conn.cpp's wasConnected

char sensorsTopicBuffer[64];
char predictionTopicBuffer[64];

PredictionState latestPrediction;

void buildTopics() {
  snprintf(sensorsTopicBuffer, sizeof(sensorsTopicBuffer), "hospital/%s/sensors", DEVICE_ID);
  snprintf(predictionTopicBuffer, sizeof(predictionTopicBuffer), "hospital/%s/prediction", DEVICE_ID);
}

// PubSubClient callback for every message on a subscribed topic. Only one
// subscription exists (predictionTopicBuffer), so no topic dispatch is
// needed yet — if a second subscription is ever added, switch on `topic`
// here instead of assuming.
void mqttMessageCallback(char *topic, uint8_t *payload, unsigned int length) {
  (void)topic;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.print("[MQTT] Prediction payload parse failed: ");
    Serial.println(err.c_str());
    return;
  }

  // `label` is the only field this device actually renders (see
  // display.cpp) — class_index/probabilities/model_version (also present
  // in the backend's payload, see services/mqtt.js) aren't needed here.
  const char *label = doc["label"] | "";
  if (label[0] == '\0') {
    // Malformed/empty payload — ignore rather than blank out an
    // already-known-good prediction on screen.
    Serial.println("[MQTT] Prediction payload missing/empty label, ignored");
    return;
  }

  strncpy(latestPrediction.label, label, PREDICTION_LABEL_MAX_LEN - 1);
  latestPrediction.label[PREDICTION_LABEL_MAX_LEN - 1] = '\0';
  latestPrediction.available = true;

  Serial.print("[MQTT] Prediction received: ");
  Serial.println(latestPrediction.label);
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
  mqttClient.setCallback(mqttMessageCallback);
  buildTopics();
}

void mqttMaintain() {
  if (!wifiIsConnected()) {
    wasConnected = false;
    return; // no point trying MQTT without WiFi
  }

  if (mqttClient.connected()) {
    if (!wasConnected) {
      Serial.print("[MQTT] Connected to broker, topic: ");
      Serial.println(sensorsTopicBuffer);
      wasConnected = true;
    }
    mqttClient.loop();
    return;
  }

  wasConnected = false;

  unsigned long now = millis();
  if (now - lastAttemptMs < MQTT_RECONNECT_INTERVAL_MS) {
    return;
  }
  lastAttemptMs = now;

  if (!mqttClient.connect(DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    // PubSubClient::state() codes: see PubSubClient.h, e.g. -4 timeout,
    // -2 connect failed, 4 bad credentials, 5 not authorized.
    Serial.print("[MQTT] Connect failed, state()=");
    Serial.println(mqttClient.state());
    return;
  }

  // Re-subscribe on every fresh connect — PubSubClient uses a clean
  // session, so a broker-side reconnect (WiFi blip, broker restart, etc.)
  // silently drops the previous subscription. The backend publishes the
  // prediction topic retained, so this immediately delivers the last
  // known label rather than leaving the display stale until the next
  // full-window prediction runs.
  if (mqttClient.subscribe(predictionTopicBuffer)) {
    Serial.print("[MQTT] Subscribed to: ");
    Serial.println(predictionTopicBuffer);
  } else {
    Serial.println("[MQTT] Subscribe to prediction topic failed");
  }
}

bool mqttIsConnected() { return mqttClient.connected(); }

bool mqttPublishReadings(const SensorReadings &readings) {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Publish skipped, not connected");
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
  // Published and persisted like the 7 official parameters (architecture.md
  // 2.3/schema.md 3.3), but intentionally excluded from thresholds.h /
  // valid[] — never gates the on-screen status label or an alert (see
  // sensor_data.h comment).
  if (readings.sht31Valid) {
    doc["temperature"] = readings.roomTempC;
    doc["humidity"] = readings.roomHumidityPct;
  }

  char payload[256];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  bool ok = mqttClient.publish(sensorsTopicBuffer, reinterpret_cast<uint8_t *>(payload),
                                len, false);

  Serial.print("[MQTT] Publish ");
  Serial.print(ok ? "OK: " : "FAILED: ");
  Serial.println(payload);

  return ok;
}

const PredictionState &mqttGetPrediction() { return latestPrediction; }
