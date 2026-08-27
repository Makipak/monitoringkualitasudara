#include "wifi_conn.h"

#include <WiFi.h>

#include "../../include/config.h"
#include "../../include/secrets.h"

namespace {
unsigned long lastAttemptMs = 0;
unsigned long connectAttemptStartMs = 0; // when the in-flight WiFi.begin() started
bool wasConnected = false;               // edge-detect disconnected -> connected
bool timeoutLogged = false;              // log the timeout status once per attempt, not every loop
} // namespace

void wifiInit() {
  WiFi.mode(WIFI_STA);

  Serial.print("[WiFi] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  connectAttemptStartMs = millis();
  timeoutLogged = false;
}

void wifiMaintain() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wasConnected) {
      Serial.print("[WiFi] Connected, IP: ");
      Serial.println(WiFi.localIP());
      wasConnected = true;
    }
    return;
  }

  wasConnected = false;

  unsigned long now = millis();

  if (!timeoutLogged &&
      (now - connectAttemptStartMs >= WIFI_CONNECT_TIMEOUT_MS)) {
    Serial.print("[WiFi] Not connected after timeout, WiFi.status()=");
    Serial.println(WiFi.status());
    timeoutLogged = true;
  }

  if (now - lastAttemptMs < WIFI_RECONNECT_INTERVAL_MS) {
    return;
  }
  lastAttemptMs = now;

  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  connectAttemptStartMs = now;
  timeoutLogged = false;
}

bool wifiIsConnected() { return WiFi.status() == WL_CONNECTED; }
