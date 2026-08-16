#include "display.h"

#include <TFT_eSPI.h>

namespace {
TFT_eSPI tft = TFT_eSPI();

void printRow(int row, const char *label, float value, bool valid,
              const char *unit) {
  constexpr int rowHeight = 24;
  constexpr int top = 40;
  tft.setCursor(8, top + row * rowHeight);
  tft.printf("%-8s", label);
  if (valid) {
    tft.printf("%7.1f %s", value, unit);
  } else {
    tft.print("   --   ");
  }
}
} // namespace

void displayInit() {
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(8, 8);
  tft.print("Udara - Air Quality");
}

void displayShowReadings(const SensorReadings &readings, bool wifiConnected,
                          bool mqttConnected) {
  tft.fillScreen(TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(8, 8);
  tft.print("Udara - Air Quality");

  tft.setTextSize(1);
  printRow(0, "PM2.5", readings.pm25, readings.valid[SENSOR_PM25], "ug/m3");
  printRow(1, "PM10", readings.pm10, readings.valid[SENSOR_PM10], "ug/m3");
  printRow(2, "NO2", readings.no2, readings.valid[SENSOR_NO2], "ppm");
  printRow(3, "CO2", readings.co2, readings.valid[SENSOR_CO2], "ppm");
  printRow(4, "TVOC", readings.tvoc, readings.valid[SENSOR_TVOC], "ppb");
  printRow(5, "Lux", readings.lux, readings.valid[SENSOR_LUX], "lux");
  printRow(6, "Noise", readings.noiseDb, readings.valid[SENSOR_NOISE], "dB");

  tft.setCursor(8, 220);
  tft.setTextColor(wifiConnected ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print(wifiConnected ? "WiFi: OK  " : "WiFi: --  ");
  tft.setTextColor(mqttConnected ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print(mqttConnected ? "MQTT: OK" : "MQTT: --");
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
}
