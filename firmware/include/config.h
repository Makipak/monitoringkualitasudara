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
// I2C bus (shared by SCD30, SGP30, BH1750, MiCS-4514) — ESP32 default pins.
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_I2C_SDA = 21;
constexpr uint8_t PIN_I2C_SCL = 22;

// ---------------------------------------------------------------------------
// PMS5003 (UART, 9600 baud, TX-only wiring is common — RX pin still
// declared in case a two-way board variant is used).
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_PMS_RX = 16; // ESP32 RX2 <- PMS5003 TX
constexpr uint8_t PIN_PMS_TX = 17; // ESP32 TX2 -> PMS5003 RX (often unused)

// ---------------------------------------------------------------------------
// MAX9814 electret mic amp — analog envelope output on an ADC1 pin
// (ADC1 must be used, not ADC2, since WiFi disables ADC2).
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_MIC_ANALOG = 34;

// ---------------------------------------------------------------------------
// TFT (ILI9341, SPI) pins — must also match include/User_Setup.h used by
// TFT_eSPI at compile time; keep both in sync if you change wiring.
// ---------------------------------------------------------------------------
constexpr uint8_t PIN_TFT_CS = 5;
constexpr uint8_t PIN_TFT_DC = 2;
constexpr uint8_t PIN_TFT_RST = 4;

// ---------------------------------------------------------------------------
// LED indicators. architecture.md lists 10x red LED on the BOM, but only 7
// are wired directly here — one per monitored parameter (thresholds.h
// order). GPIOs 21/22 (I2C), 16/17 (PMS UART), 5/2/4/18/19/23 (TFT SPI)
// and 34 (mic ADC) are already spoken for, which doesn't leave 10 safe
// free GPIOs on a bare DevKitC V4. The remaining 3 LEDs need either an
// I2C GPIO expander (e.g. PCF8574) or a different MCU pin budget —
// revisit once the physical LED layout/purpose for those 3 is decided
// (see prd.md Open Questions).
// ---------------------------------------------------------------------------
constexpr uint8_t NUM_LEDS = 7;
constexpr uint8_t LED_PINS[NUM_LEDS] = {
    12, 13, 14, 15, 25, 26, 27, // pm25, pm10, no2, co2, tvoc, lux, noise
};

#endif // CONFIG_H
