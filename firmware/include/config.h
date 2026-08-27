#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ---------------------------------------------------------------------------
// Device identity — must match the `device_id` used in `devices` table
// (schema.md) and the MQTT topic `hospital/{device_id}/sensors`
// (architecture.md section 3).
// ---------------------------------------------------------------------------
constexpr const char *DEVICE_ID = "room-01";

// ---------------------------------------------------------------------------
// Timing (rule.md 5: interval as a named constant, not a magic number).
// prd.md's non-functional "Reliabilitas" row originally left the publish
// interval as an open candidate (30-60s). Decided at implementation: the
// app must show the same value the on-device screen is showing, not a
// stale one lagging tens of seconds behind it — a mismatch that would be
// an obvious question during sidang. So there is no separate, slower
// publish timer anymore; mqttPublishReadings() rides the same tick as the
// local read/display refresh below (see main.cpp loop()).
// ---------------------------------------------------------------------------
constexpr unsigned long SENSOR_READ_INTERVAL_MS = 5000;     // local read + display refresh + MQTT publish
constexpr unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 8000; // diagnostic-only: how
    // long a single WiFi.begin() attempt gets before wifiMaintain() logs
    // WiFi.status() for debugging; kept below WIFI_RECONNECT_INTERVAL_MS so
    // it fires once per attempt, before the next retry resets the timer.

// ---------------------------------------------------------------------------
// I2C bus (shared by SGP30, MiCS-4514, BH1750, GY-SHT31) — ESP32 default
// pins. GY-SHT31 default address is 0x44, doesn't collide with the others.
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_I2C_SDA = 21;
constexpr uint8_t PIN_I2C_SCL = 22;

// ---------------------------------------------------------------------------
// SDS011 (PM2.5/PM10), UART1 — replaces the originally planned PMS5003;
// see architecture.md 2.1 note "Catatan penggantian sensor PM2.5/PM10"
// (component swapped due to seller pre-order lead time, pin allocation
// unchanged from the original PMS5003 plan).
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_SDS011_RX = 16; // ESP32 UART1 RX <- SDS011 TX
constexpr uint8_t PIN_SDS011_TX = 17; // ESP32 UART1 TX -> SDS011 RX

// ---------------------------------------------------------------------------
// MH-Z19B (CO2), UART2 — replaces the originally planned SCD30 (I2C);
// see architecture.md 2.1 note "Catatan penggantian sensor CO2". This
// UART was originally reserved for a Nextion display, which is no longer
// used now that the display is TFT SPI (ST7796), so no pin conflict.
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_MHZ19_RX = 32; // ESP32 UART2 RX <- MH-Z19B TX
constexpr uint8_t PIN_MHZ19_TX = 33; // ESP32 UART2 TX -> MH-Z19B RX

// ---------------------------------------------------------------------------
// MAX9814 electret mic amp — analog envelope output on an ADC1 pin
// (ADC1 must be used, not ADC2, since WiFi disables ADC2).
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_MIC_ANALOG = 34;

// ---------------------------------------------------------------------------
// TFT (ST7796, 4.0" 480x320, SPI) pins — must also match
// include/User_Setup.h used by TFT_eSPI at compile time; keep both in
// sync if you change wiring. Pin roles per architecture.md 2.1 note
// "Catatan pemilihan display" — this is a custom (non-default-VSPI)
// GPIO-matrix mapping, not the ESP32's native hardware SPI pins, which
// TFT_eSPI supports at a small performance cost vs. native VSPI.
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_TFT_MOSI = 15;
constexpr uint8_t PIN_TFT_MISO = 4;
constexpr uint8_t PIN_TFT_SCLK = 2;
constexpr uint8_t PIN_TFT_CS = 23;
constexpr uint8_t PIN_TFT_DC = 18;
constexpr uint8_t PIN_TFT_RST = 19;

// ---------------------------------------------------------------------------
// No LED indicator pins here — the earlier per-parameter red-LED design
// (architecture.md 2.2, prd.md FR-D3) was dropped; out-of-range parameters
// are shown on the TFT instead (Normal/Tidak Normal label, see
// firmware/src/display/display.cpp + include/thresholds.h). GPIOs 5, 12,
// 13, 14, 25, 26, 27 (previously reserved for LEDs) are free.
// ---------------------------------------------------------------------------

#endif // CONFIG_H
