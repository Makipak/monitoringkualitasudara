#ifndef DISPLAY_DISPENSER_THEME_H
#define DISPLAY_DISPENSER_THEME_H

#include <Arduino.h>

// Shared visual language for the "Smart Dispenser" card-based UI, used by
// both display backends:
//   display_tftespi.cpp — ESP32 DevKitC V4 target, TFT_eSPI
//   display_gfx.cpp      — ESP32-S3 target, Arduino_GFX_Library
// Two different graphics libraries with two different low-level drawing
// APIs are involved, so the actual drawing code is duplicated one file per
// backend (documented there) — but this file is the single shared source
// for every color/layout constant (rule.md 5: no magic numbers/colors
// scattered across files), so both backends render the same look. Ported
// from the ESP32-S3 Arduino IDE bring-up sketch
// (firmware/arduino_ide/UdaraS3/UdaraS3.ino, now decomposed into this
// project — that sketch folder no longer exists).
//
// Panel: ST7796 4.0" 480x320 SPI, landscape, on both board targets —
// different wiring/library per board, same physical panel + resolution.

constexpr int SCREEN_WIDTH = 480;
constexpr int SCREEN_HEIGHT = 320;

// RGB565 theme colors.
constexpr uint16_t THEME_BG = 0x0825;
constexpr uint16_t THEME_CARD = 0x18E7;
constexpr uint16_t THEME_BORDER = 0x3189;
constexpr uint16_t THEME_ACCENT = 0x07E0;  // in-range value / WiFi+MQTT OK
constexpr uint16_t THEME_DANGER = 0xF800;  // out-of-range value / disconnected
constexpr uint16_t THEME_WARNING = 0xFD20; // prediction bar: Rawan
constexpr uint16_t THEME_ORANGE = 0xFC00;  // prediction bar: Peringatan
constexpr uint16_t THEME_TEXT = 0xFFFF;
constexpr uint16_t THEME_TEXT_DIM = 0xBDF7; // invalid reading / supporting
                                             // info (Temp/Humidity) / "not
                                             // available yet" prediction text
constexpr uint16_t THEME_PILL_TEXT = 0x0000; // black text on the prediction
                                              // pill — readable against
                                              // every severity color below

// Header bar (title + WiFi/MQTT status).
constexpr int HEADER_HEIGHT = 35;
constexpr int HEADER_TITLE_X = 15;
constexpr int HEADER_TITLE_Y = 10;
constexpr int HEADER_WIFI_STATUS_X = 340;
constexpr int HEADER_MQTT_STATUS_X = 410;
constexpr int HEADER_STATUS_Y = 14;

// 3x3 sensor-card grid: 7 official parameters (evaluated against
// thresholds.h) + Temp/Humidity (always neutral, see sensor_data.h) fill
// all 9 slots.
constexpr int CARD_COL_X[3] = {12, 167, 322};
constexpr int CARD_ROW_Y[3] = {45, 115, 185};
constexpr int CARD_WIDTH = 145;
constexpr int CARD_HEIGHT = 65;
constexpr int CARD_RADIUS = 8;

// AI-prediction card, spanning the full width below the grid.
constexpr int PREDICTION_CARD_X = 12;
constexpr int PREDICTION_CARD_Y = 260;
constexpr int PREDICTION_CARD_WIDTH = 455;
constexpr int PREDICTION_CARD_HEIGHT = 50;
constexpr int PREDICTION_CARD_RADIUS = 8;
constexpr int PREDICTION_LABEL_X = 25;
constexpr int PREDICTION_LABEL_Y = 276;
constexpr int PREDICTION_PILL_X = 180;
constexpr int PREDICTION_PILL_Y = 268;
constexpr int PREDICTION_PILL_WIDTH = 275;
constexpr int PREDICTION_PILL_HEIGHT = 34;
constexpr int PREDICTION_PILL_RADIUS = 6;

// The 4 composite-status labels the BiGRU classifier can output
// (ml-service/metadata.json label_map) and the color for each — order
// matters, low severity to high, matching PREDICTION_COLORS by index.
constexpr int PREDICTION_LABELS_COUNT = 4;
constexpr const char *PREDICTION_LABELS[PREDICTION_LABELS_COUNT] = {
    "Baik", "Rawan", "Peringatan", "Bahaya"};
constexpr uint16_t PREDICTION_COLORS[PREDICTION_LABELS_COUNT] = {
    THEME_ACCENT, THEME_WARNING, THEME_ORANGE, THEME_DANGER};

#endif // DISPLAY_DISPENSER_THEME_H
