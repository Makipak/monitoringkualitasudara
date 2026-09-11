#ifndef DISPLAY_DISPLAY_H
#define DISPLAY_DISPLAY_H

#include "../../include/sensor_data.h"

// Shared interface, two backend implementations — only one is ever
// compiled per board target (see platformio.ini's per-env
// build_src_filter):
//   display_tftespi.cpp — ESP32 DevKitC V4 target, TFT_eSPI
//   display_gfx.cpp      — ESP32-S3 target, Arduino_GFX_Library
// Both render the same "Smart Dispenser" card-based UI (shared
// colors/layout constants in dispenser_theme.h) against the same physical
// ST7796 4.0" 480x320 panel — the drawing code itself is duplicated one
// file per backend since the two graphics libraries have different APIs,
// not out of laziness (see dispenser_theme.h's top comment).
void displayInit();

// Renders all 7 official parameters as a color-coded value card (green if
// within thresholds.h's normal range, red if not, dim grey if the sensor
// read failed — the device's only out-of-range indicator now, there is no
// LED), room temperature + humidity as their own cards, connectivity
// status in the header, and the composite AI prediction card (Baik/Rawan/
// Peringatan/Bahaya — see sensor_data.h's PredictionState comment for why
// this device only ever displays a label it received over MQTT, never
// computes one itself). Pure presentation — does not touch sensors or
// network state directly (rule.md 3: keep sensor-read and display logic
// in separate functions/files).
//
// The two backends intentionally differ on one thing: display_tftespi.cpp
// (DevKitC V4) always renders Temp/Humidity dim-grey, never green/red
// (schema.md 3.4 excludes both from threshold evaluation); display_gfx.cpp
// (ESP32-S3) matches its source Arduino IDE bring-up sketch exactly
// instead, where those two cards do turn green when valid — see that
// file's drawSensorCard() comment before "fixing" this discrepancy.
void displayShowReadings(const SensorReadings &readings, bool wifiConnected,
                          bool mqttConnected, const PredictionState &prediction);

#endif // DISPLAY_DISPLAY_H
