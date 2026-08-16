#include "wifi_conn.h"

#include <WiFi.h>

#include "../../include/config.h"
#include "../../include/secrets.h"

namespace {
unsigned long lastAttemptMs = 0;
}

void wifiInit() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void wifiMaintain() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  unsigned long now = millis();
  if (now - lastAttemptMs < WIFI_RECONNECT_INTERVAL_MS) {
    return;
  }
  lastAttemptMs = now;

  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

bool wifiIsConnected() { return WiFi.status() == WL_CONNECTED; }
