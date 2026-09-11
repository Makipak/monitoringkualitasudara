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
//
// SENSOR_READ_INTERVAL_MS is board-specific and deliberately NOT unified:
// the ESP32-S3 value (1500ms) is copied byte-for-byte from the Arduino IDE
// bring-up sketch that was verified working on the real S3 hardware
// (firmware/arduino_ide/UdaraS3/UdaraS3.ino, now decomposed into this
// project) — don't change it to match the DevKitC V4 value below or vice
// versa without the user asking for that specifically.
// ---------------------------------------------------------------------------
#if CONFIG_IDF_TARGET_ESP32S3
constexpr unsigned long SENSOR_READ_INTERVAL_MS = 1500; // local read + display refresh + MQTT publish
#else
constexpr unsigned long SENSOR_READ_INTERVAL_MS = 5000; // local read + display refresh + MQTT publish
#endif
constexpr unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 8000; // diagnostic-only: how
    // long a single WiFi.begin() attempt gets before wifiMaintain() logs
    // WiFi.status() for debugging; kept below WIFI_RECONNECT_INTERVAL_MS so
    // it fires once per attempt, before the next retry resets the timer.

// ---------------------------------------------------------------------------
// Pin map — two board targets share this file (platformio.ini
// [env:esp32doit-devkit-v1] and [env:esp32-s3-devkitc-1], see that file's
// top-of-file comment). CONFIG_IDF_TARGET_ESP32S3 is defined automatically
// by the Arduino-ESP32/ESP-IDF core based on which board a PlatformIO env
// targets — no manual build flag needed, it just follows `board =`.
// Selecting pins this way (one file, one #if per board) instead of two
// separate config headers keeps rule.md 5's "thresholds/config centralized
// in one file" intent while still supporting two physically different
// wiring layouts.
// ---------------------------------------------------------------------------
#if CONFIG_IDF_TARGET_ESP32S3
// --- ESP32-S3 (N16R8) pin map — ported from the Arduino IDE bring-up
// sketch firmware/arduino_ide/UdaraS3/UdaraS3.ino (now decomposed into
// this project; that sketch folder no longer exists). Chosen by that
// bring-up to be conflict-free across all sensors + the ST7796 display on
// this specific board's pinout.

// I2C bus 1 (main) — SGP30, BH1750, GY-SHT31. GY-SHT31 default address is
// 0x44, doesn't collide with the others.
constexpr uint8_t PIN_I2C_SDA = 8;
constexpr uint8_t PIN_I2C_SCL = 9;

// I2C bus 2 (Wire1), dedicated to MiCS-4514 only — found necessary during
// ESP32-S3 bring-up (see src/sensors/mics4514.cpp): sharing the main I2C
// bus left the chip's interface controller intermittently asleep when
// several I2C sensors were begin()'d back-to-back. Not used on the
// ESP32 DevKitC V4 target, where MiCS-4514 shares the single I2C bus with
// everything else (see the #else branch below) — no such conflict was
// observed there.
constexpr uint8_t PIN_MICS_SDA = 4;
constexpr uint8_t PIN_MICS_SCL = 5;

// SDS011 (PM2.5/PM10), UART1.
constexpr uint8_t PIN_SDS011_RX = 1; // ESP32-S3 UART1 RX <- SDS011 TX
constexpr uint8_t PIN_SDS011_TX = 2; // ESP32-S3 UART1 TX -> SDS011 RX

// CO2 (Winsen MH-Z19C), UART2 — see src/sensors/mhz19c.h for the sensor's
// own hardware history (unrelated to the board swap here).
constexpr uint8_t PIN_MHZ19C_RX = 17; // ESP32-S3 UART2 RX <- CO2 module TX
constexpr uint8_t PIN_MHZ19C_TX = 18; // ESP32-S3 UART2 TX -> CO2 module RX

// MAX9814 electret mic amp — analog envelope output. GPIO6 is an ADC1
// channel on the S3 (ADC1 must be used, not ADC2, since WiFi disables
// ADC2, same rule as the classic ESP32).
constexpr uint8_t PIN_MIC_ANALOG = 6;

// TFT (ST7796, 4.0" 480x320, SPI) — driven by Arduino_GFX_Library
// (Arduino_ESP32SPI + Arduino_ST7796, see src/display/display_gfx.cpp),
// not TFT_eSPI, so these are read directly at runtime as constructor
// arguments — no separate User_Setup.h macro injection needed on this
// board target.
constexpr uint8_t PIN_TFT_CS = 10;
constexpr uint8_t PIN_TFT_MOSI = 11;
constexpr uint8_t PIN_TFT_SCLK = 12;
constexpr uint8_t PIN_TFT_MISO = 13;
constexpr uint8_t PIN_TFT_DC = 14;
constexpr uint8_t PIN_TFT_RST = 15;

#else
// --- ESP32 DevKitC V4 (WROOM-32D) pin map — the original product
// decision (architecture.md 2.1).

// I2C bus (shared by SGP30, MiCS-4514, BH1750, GY-SHT31) — ESP32 default
// pins. GY-SHT31 default address is 0x44, doesn't collide with the others.
constexpr uint8_t PIN_I2C_SDA = 21;
constexpr uint8_t PIN_I2C_SCL = 22;

// SDS011 (PM2.5/PM10), UART1 — replaces the originally planned PMS5003;
// see architecture.md 2.1 note "Catatan penggantian sensor PM2.5/PM10"
// (component swapped due to seller pre-order lead time, pin allocation
// unchanged from the original PMS5003 plan).
constexpr uint8_t PIN_SDS011_RX = 16; // ESP32 UART1 RX <- SDS011 TX
constexpr uint8_t PIN_SDS011_TX = 17; // ESP32 UART1 TX -> SDS011 RX

// CO2 (Winsen MH-Z19C, NDIR), UART2 — replaces the originally planned
// SCD30 (I2C); see architecture.md 2.1 note "Catatan penggantian sensor
// CO2". This UART was originally reserved for a Nextion display, which
// is no longer used now that the display is TFT SPI (ST7796), so no pin
// conflict. Pin names went PIN_MHZ19_* -> PIN_MWD1006_* (2026-08-27,
// physical module turned out to be a Huiwen MWD1006, not a genuine
// Winsen MH-Z19B) -> PIN_MHZ19C_* (2026-09-01, that MWD1006 unit stopped
// working and was replaced with a genuine Winsen MH-Z19C) — see
// src/sensors/mhz19c.h for the full history.
constexpr uint8_t PIN_MHZ19C_RX = 32; // ESP32 UART2 RX <- CO2 module TX
constexpr uint8_t PIN_MHZ19C_TX = 33; // ESP32 UART2 TX -> CO2 module RX

// MAX9814 electret mic amp — analog envelope output on an ADC1 pin
// (ADC1 must be used, not ADC2, since WiFi disables ADC2).
constexpr uint8_t PIN_MIC_ANALOG = 34;

// TFT (ST7796, 4.0" 480x320, SPI) pins — must also match
// include/User_Setup.h used by TFT_eSPI at compile time; keep both in
// sync if you change wiring. Pin roles per architecture.md 2.1 note
// "Catatan pemilihan display" — this is a custom (non-default-VSPI)
// GPIO-matrix mapping, not the ESP32's native hardware SPI pins, which
// TFT_eSPI supports at a small performance cost vs. native VSPI.
constexpr uint8_t PIN_TFT_MOSI = 15;
constexpr uint8_t PIN_TFT_MISO = 4;
constexpr uint8_t PIN_TFT_SCLK = 2;
constexpr uint8_t PIN_TFT_CS = 23;
constexpr uint8_t PIN_TFT_DC = 18;
constexpr uint8_t PIN_TFT_RST = 19;
#endif // CONFIG_IDF_TARGET_ESP32S3

// ---------------------------------------------------------------------------
// No LED indicator pins here — the earlier per-parameter red-LED design
// (architecture.md 2.2, prd.md FR-D3) was dropped; out-of-range parameters
// are shown on the TFT instead (Normal/Tidak Normal label, see
// firmware/src/display/ + include/thresholds.h). On the ESP32 DevKitC V4
// target, GPIOs 5, 12, 13, 14, 25, 26, 27 (previously reserved for LEDs)
// are free.
// ---------------------------------------------------------------------------

#endif // CONFIG_H
