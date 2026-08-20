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
// PRD candidate range is 30-60s; start at 30s and tune after field testing.
// ---------------------------------------------------------------------------
constexpr unsigned long SENSOR_READ_INTERVAL_MS = 5000;     // local read + display refresh
constexpr unsigned long MQTT_PUBLISH_INTERVAL_MS = 30000;   // publish to broker
constexpr unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;

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
// LED indicators. architecture.md lists 10x red LED on the BOM, but only 7
// are wired directly here — one per monitored parameter (thresholds.h
// order). GPIOs 21/22 (I2C), 16/17 (SDS011 UART1), 32/33 (MH-Z19B UART2),
// 34 (mic ADC) and 15/4/2/23/18/19 (TFT SPI) are already spoken for,
// which doesn't leave 10 safe free GPIOs on a bare DevKitC V4. The
// remaining 3 LEDs need either an I2C GPIO expander (e.g. PCF8574) or a
// different MCU pin budget — revisit once the physical LED layout/
// purpose for those 3 is decided (see prd.md Open Questions).
// GPIO0 is deliberately excluded from this pool (boot-strapping pin).
// ---------------------------------------------------------------------------
constexpr uint8_t NUM_LEDS = 7;
constexpr uint8_t LED_PINS[NUM_LEDS] = {
    5, 12, 13, 14, 25, 26, 27, // pm25, pm10, no2, co2, tvoc, lux, noise
};

#endif // CONFIG_H
