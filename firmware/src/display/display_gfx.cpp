// Arduino_GFX_Library backend for the ESP32-S3 target — see display.h's
// top-of-file comment for how this relates to display_tftespi.cpp (the
// ESP32 DevKitC V4/TFT_eSPI backend). Ported from the ESP32-S3 Arduino IDE
// bring-up sketch (firmware/arduino_ide/UdaraS3/UdaraS3.ino, now
// decomposed into this project). Only compiled for
// [env:esp32-s3-devkitc-1]; excluded from the ESP32 DevKitC V4 build via
// platformio.ini's build_src_filter.
//
// Arduino_GFX rather than TFT_eSPI is what was actually verified working
// against this ST7796 panel wired to the ESP32-S3 board — same physical
// panel as the DevKitC V4 target, different library/wiring.

#include "display.h"

#include <Arduino_GFX_Library.h>
#include <string.h>

#include "../../include/config.h"
#include "../../include/thresholds.h"
#include "dispenser_theme.h"

namespace {
// Hardware SPI bus + ST7796 driver, built once at startup — see config.h's
// CONFIG_IDF_TARGET_ESP32S3 pin block for PIN_TFT_*. rotation=1 is the
// value confirmed (during the original bring-up) to produce the correct
// landscape orientation on this board+library combination — a different
// value than display_tftespi.cpp's rotation=3, since that's a different
// library/wiring on a different board; not a copy-paste mismatch.
Arduino_DataBus *bus = new Arduino_ESP32SPI(PIN_TFT_DC, PIN_TFT_CS, PIN_TFT_SCLK,
                                             PIN_TFT_MOSI, PIN_TFT_MISO);
Arduino_GFX *gfx = new Arduino_ST7796(bus, PIN_TFT_RST, 1 /* rotation */);
} // namespace

#define tft (*gfx)

namespace {
// Arduino_GFX (Adafruit_GFX-style API) has no textWidth() — getTextBounds()
// is its equivalent for centering/right-aligning text. Kept as its own
// function so displayShowReadings()'s drawing code below reads the same
// as display_tftespi.cpp's.
int getTxtWidth(const char *text) {
  int16_t x1, y1;
  uint16_t w, h;
  tft.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  return w;
}

int predictionLabelIndex(const char *label) {
  for (int i = 0; i < PREDICTION_LABELS_COUNT; i++) {
    if (strcmp(label, PREDICTION_LABELS[i]) == 0) return i;
  }
  return -1; // unrecognized label (e.g. a future 5th class) - fail safe,
             // still shown as text, just no pill color
}

void drawUIHeader(bool wifiOK, bool mqttOK) {
  tft.fillScreen(THEME_BG);
  tft.fillRect(0, 0, SCREEN_WIDTH, HEADER_HEIGHT, THEME_CARD);
  tft.drawFastHLine(0, HEADER_HEIGHT, SCREEN_WIDTH, THEME_BORDER);

  tft.setTextColor(THEME_ACCENT);
  tft.setTextSize(2);
  tft.setCursor(HEADER_TITLE_X, HEADER_TITLE_Y);
  tft.print("KUALITAS UDARA RS");

  tft.setTextSize(1);
  tft.setTextColor(wifiOK ? THEME_ACCENT : THEME_DANGER);
  tft.setCursor(HEADER_WIFI_STATUS_X, HEADER_STATUS_Y);
  tft.print(wifiOK ? "WIFI: OK" : "WIFI: DC");

  tft.setTextColor(mqttOK ? THEME_ACCENT : THEME_DANGER);
  tft.setCursor(HEADER_MQTT_STATUS_X, HEADER_STATUS_Y);
  tft.print(mqttOK ? "MQTT: OK" : "MQTT: DC");
}

// One card: label at small size, a large color-coded value, then the unit
// tucked just after it. `sensorIndex` is thresholds.h's SensorIndex
// (0..6) for one of the 7 official parameters, evaluated against its
// normal range to pick green/red; -1 for a non-official card (Temp/
// Humidity) always evaluates as "not out of range" (green when valid) —
// copied as-is from the Arduino IDE bring-up sketch's drawSensorCard()
// (isWarning hardcoded false for those two cards there). NOTE: this
// differs from display_tftespi.cpp's DevKitC V4 backend, which instead
// forces Temp/Humidity to always-dim per this project's own established
// rule (sensor_data.h's roomTempC/roomHumidityPct warning comment) — kept
// as an intentional, documented divergence between the two board
// backends rather than silently "fixed" here, since this file is meant
// to match the bring-up sketch exactly.
void drawSensorCard(int x, int y, const char *label, float value, bool valid,
                     int sensorIndex, const char *unit, int decimals) {
  tft.fillRoundRect(x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, THEME_CARD);
  tft.drawRoundRect(x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, THEME_BORDER);

  tft.setTextColor(THEME_TEXT_DIM);
  tft.setTextSize(2);
  tft.setCursor(x + 10, y + 10);
  tft.print(label);

  char valueBuf[16];
  uint16_t valueColor;
  if (!valid) {
    valueColor = THEME_TEXT_DIM;
    snprintf(valueBuf, sizeof(valueBuf), "--");
  } else {
    bool isWarning = (sensorIndex >= 0) && thresholdOutOfRange(sensorIndex, value);
    valueColor = isWarning ? THEME_DANGER : THEME_ACCENT;
    snprintf(valueBuf, sizeof(valueBuf), "%.*f", decimals, value);
  }

  tft.setTextColor(valueColor);
  tft.setTextSize(3);
  tft.setCursor(x + 10, y + 35);
  tft.print(valueBuf);

  int valueWidth = getTxtWidth(valueBuf);
  tft.setTextColor(THEME_TEXT);
  tft.setTextSize(1);
  tft.setCursor(x + 10 + valueWidth + 5, y + 48);
  tft.print(unit);
}

// The bottom AI-prediction card: title text plus either a dim "waiting"
// message (prediction.available == false — e.g. right after boot, or
// indefinitely for as long as the CO2/lux/temperature/humidity sensors
// stay uninstalled and the backend never has a full window to predict
// from — see sensor_data.h's PredictionState comment) or a colored pill
// holding the latest received label. Never guesses a label/color when
// none has been received.
void drawPredictionCard(const PredictionState &prediction) {
  tft.fillRoundRect(PREDICTION_CARD_X, PREDICTION_CARD_Y, PREDICTION_CARD_WIDTH,
                     PREDICTION_CARD_HEIGHT, PREDICTION_CARD_RADIUS, THEME_CARD);
  tft.drawRoundRect(PREDICTION_CARD_X, PREDICTION_CARD_Y, PREDICTION_CARD_WIDTH,
                     PREDICTION_CARD_HEIGHT, PREDICTION_CARD_RADIUS,
                     THEME_BORDER);

  tft.setTextColor(THEME_TEXT);
  tft.setTextSize(2);
  tft.setCursor(PREDICTION_LABEL_X, PREDICTION_LABEL_Y);
  tft.print("AI Prediksi:");

  if (!prediction.available) {
    tft.setTextColor(THEME_TEXT_DIM);
    tft.setCursor(PREDICTION_PILL_X, PREDICTION_LABEL_Y);
    tft.print("Menunggu Analisis...");
    return;
  }

  int idx = predictionLabelIndex(prediction.label);
  uint16_t pillColor = (idx >= 0) ? PREDICTION_COLORS[idx] : THEME_TEXT_DIM;
  tft.fillRoundRect(PREDICTION_PILL_X, PREDICTION_PILL_Y, PREDICTION_PILL_WIDTH,
                     PREDICTION_PILL_HEIGHT, PREDICTION_PILL_RADIUS, pillColor);

  tft.setTextColor(THEME_PILL_TEXT);
  tft.setTextSize(2);
  int labelWidth = getTxtWidth(prediction.label);
  tft.setCursor(PREDICTION_PILL_X + (PREDICTION_PILL_WIDTH - labelWidth) / 2,
                PREDICTION_PILL_Y + 8);
  tft.print(prediction.label);
}
} // namespace

void displayInit() {
  if (!tft.begin()) {
    // Arduino_ST7796's begin() drives PIN_TFT_RST itself — no manual
    // reset sequence needed here (unlike display_tftespi.cpp's TFT_eSPI
    // backend, which does its own explicit reset before tft.init()).
    Serial.println("[Display] Arduino_GFX begin() failed");
  }
  tft.fillScreen(THEME_BG);
  // Draw the header immediately (WiFi/MQTT both shown disconnected) so
  // the panel doesn't sit on a blank screen for the first
  // SENSOR_READ_INTERVAL_MS until the first displayShowReadings() call —
  // matches the bring-up sketch's displayInit(), which does the same.
  drawUIHeader(false, false);
}

void displayShowReadings(const SensorReadings &readings, bool wifiConnected,
                          bool mqttConnected,
                          const PredictionState &prediction) {
  drawUIHeader(wifiConnected, mqttConnected);

  drawSensorCard(CARD_COL_X[0], CARD_ROW_Y[0], "PM2.5", readings.pm25,
                 readings.valid[SENSOR_PM25], SENSOR_PM25, "ug/m3", 1);
  drawSensorCard(CARD_COL_X[1], CARD_ROW_Y[0], "PM10", readings.pm10,
                 readings.valid[SENSOR_PM10], SENSOR_PM10, "ug/m3", 1);
  drawSensorCard(CARD_COL_X[2], CARD_ROW_Y[0], "CO2", readings.co2,
                 readings.valid[SENSOR_CO2], SENSOR_CO2, "ppm", 0);

  drawSensorCard(CARD_COL_X[0], CARD_ROW_Y[1], "TVOC", readings.tvoc,
                 readings.valid[SENSOR_TVOC], SENSOR_TVOC, "ppb", 0);
  drawSensorCard(CARD_COL_X[1], CARD_ROW_Y[1], "NO2", readings.no2,
                 readings.valid[SENSOR_NO2], SENSOR_NO2, "ppm", 2);
  drawSensorCard(CARD_COL_X[2], CARD_ROW_Y[1], "Lux", readings.lux,
                 readings.valid[SENSOR_LUX], SENSOR_LUX, "lx", 0);

  // sensorIndex -1: Temp/Humidity never evaluate as "out of range" here
  // (green when valid) — see drawSensorCard's comment for why this file
  // keeps that as-is from the bring-up sketch instead of the DevKitC V4
  // backend's stricter always-dim rule.
  drawSensorCard(CARD_COL_X[0], CARD_ROW_Y[2], "Temp", readings.roomTempC,
                 readings.sht31Valid, -1, "C", 1);
  drawSensorCard(CARD_COL_X[1], CARD_ROW_Y[2], "Humid",
                 readings.roomHumidityPct, readings.sht31Valid, -1, "%RH", 1);
  drawSensorCard(CARD_COL_X[2], CARD_ROW_Y[2], "Noise", readings.noiseDb,
                 readings.valid[SENSOR_NOISE], SENSOR_NOISE, "dB", 1);

  drawPredictionCard(prediction);
}
