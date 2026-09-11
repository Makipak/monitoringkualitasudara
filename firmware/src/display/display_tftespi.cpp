// TFT_eSPI backend for the ESP32 DevKitC V4 target — see display.h's
// top-of-file comment for how this relates to display_gfx.cpp (the
// ESP32-S3/Arduino_GFX_Library backend). Only compiled for
// [env:esp32doit-devkit-v1] (and its dev-display variant); excluded from
// the ESP32-S3 build via platformio.ini's build_src_filter.

#include "display.h"

#include <TFT_eSPI.h>
#include <string.h>

#include "../../include/thresholds.h"
#include "dispenser_theme.h"

namespace {
TFT_eSPI tft = TFT_eSPI();

// TFT_eSPI has no getTextBounds() (that's an Adafruit_GFX/Arduino_GFX
// method) — textWidth() is its equivalent for centering/right-aligning
// text. Kept as its own function so displayShowReadings()'s drawing code
// below reads the same as display_gfx.cpp's.
int getTxtWidth(const char *text) { return tft.textWidth(text); }

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
// normal range to pick green/red. Pass -1 for a non-official card
// (Temp/Humidity — see sensor_data.h) to force dim-grey regardless of
// `valid`, instead of fabricating a normal/abnormal status for a
// parameter that was never meant to have one.
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
  } else if (sensorIndex < 0) {
    // Supporting info only (Temp/Humidity) — always dim, never colored as
    // if it had passed/failed a threshold it was never evaluated against.
    valueColor = THEME_TEXT_DIM;
    snprintf(valueBuf, sizeof(valueBuf), "%.*f", decimals, value);
  } else {
    valueColor =
        thresholdOutOfRange(sensorIndex, value) ? THEME_DANGER : THEME_ACCENT;
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
  pinMode(TFT_RST, OUTPUT);
  digitalWrite(TFT_RST, LOW);
  delay(50);
  digitalWrite(TFT_RST, HIGH);
  delay(50);

  tft.init();
  // rotation 3, not 1: this specific ST7796 4.0" module's native
  // orientation is 180 degrees from TFT_eSPI's usual landscape default
  // (rotation 1) — confirmed on real hardware 2026-08-27 (content was
  // rendering upside down / left-right flipped with rotation 1, title
  // landed at the bottom instead of the top). Rotation values are
  // module-specific; don't assume 1 == "landscape, right side up" on a
  // different physical panel.
  tft.setRotation(3);
  tft.fillScreen(THEME_BG);
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

  // sensorIndex -1: Temp/Humidity are supporting info only, never
  // green/red (see drawSensorCard's comment / sensor_data.h).
  drawSensorCard(CARD_COL_X[0], CARD_ROW_Y[2], "Temp", readings.roomTempC,
                 readings.sht31Valid, -1, "C", 1);
  drawSensorCard(CARD_COL_X[1], CARD_ROW_Y[2], "Humid",
                 readings.roomHumidityPct, readings.sht31Valid, -1, "%RH", 1);
  drawSensorCard(CARD_COL_X[2], CARD_ROW_Y[2], "Noise", readings.noiseDb,
                 readings.valid[SENSOR_NOISE], SENSOR_NOISE, "dB", 1);

  drawPredictionCard(prediction);
}
