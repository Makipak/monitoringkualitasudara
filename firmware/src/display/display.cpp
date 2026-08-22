#include "display.h"

#include <TFT_eSPI.h>

namespace {
TFT_eSPI tft = TFT_eSPI();

// Layout tuned for the ST7796 480x320 panel (landscape, rotation 1) —
// bigger than the ILI9341 2.8" this replaced, so text size/spacing here
// deliberately doesn't match the old 320x240 numbers.
//
// If building with the temporary `esp32doit-devkit-v1-dev-display`
// PlatformIO environment (interim 240x320 ILI9341-family panel, see
// User_Setup_Dev.h), this layout will run off the bottom of that
// smaller screen — expected during bench-testing, not a bug; values are
// also visible via `pio device monitor` if needed. Don't "fix" this
// layout for the dev display; it's meant to match the final ST7796 unit.
constexpr int ROW_HEIGHT = 28;
constexpr int ROW_TOP = 56;
constexpr int STATUS_ROW_Y = 292; // 8 rows (7 params + temp) end around
                                   // y=252+20; leaves clear space before
                                   // this on a 320px-tall landscape screen

void printRow(int row, const char *label, float value, bool valid,
              const char *unit) {
  tft.setCursor(16, ROW_TOP + row * ROW_HEIGHT);
  tft.printf("%-8s", label);
  if (valid) {
    tft.printf("%8.1f %s", value, unit);
  } else {
    tft.print("     --   ");
  }
}
} // namespace

void displayInit() {
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(3);
  tft.setCursor(16, 12);
  tft.print("Udara - Air Quality");
}

void displayShowReadings(const SensorReadings &readings, bool wifiConnected,
                          bool mqttConnected) {
  tft.fillScreen(TFT_BLACK);
  tft.setTextSize(3);
  tft.setCursor(16, 12);
  tft.print("Udara - Air Quality");

  tft.setTextSize(2);
  printRow(0, "PM2.5", readings.pm25, readings.valid[SENSOR_PM25], "ug/m3");
  printRow(1, "PM10", readings.pm10, readings.valid[SENSOR_PM10], "ug/m3");
  printRow(2, "NO2", readings.no2, readings.valid[SENSOR_NO2], "ppm");
  printRow(3, "CO2", readings.co2, readings.valid[SENSOR_CO2], "ppm");
  printRow(4, "TVOC", readings.tvoc, readings.valid[SENSOR_TVOC], "ppb");
  printRow(5, "Lux", readings.lux, readings.valid[SENSOR_LUX], "lux");
  printRow(6, "Noise", readings.noiseDb, readings.valid[SENSOR_NOISE], "dB");

  // Room temperature — published/stored like the 7 official parameters,
  // but not one of them (architecture.md 2.1 "Catatan suhu ruangan" /
  // schema.md 3.4): shown visually distinct here too (grey, no threshold
  // color logic) so it still reads as supporting info, not a
  // monitored/alerted value.
  tft.setTextColor(TFT_DARKGREY, TFT_BLACK);
  printRow(7, "Temp", readings.roomTempC, readings.roomTempValid, "C");
  tft.setTextColor(TFT_WHITE, TFT_BLACK);

  tft.setCursor(16, STATUS_ROW_Y);
  tft.setTextColor(wifiConnected ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print(wifiConnected ? "WiFi: OK  " : "WiFi: --  ");
  tft.setTextColor(mqttConnected ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print(mqttConnected ? "MQTT: OK" : "MQTT: --");
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
}
