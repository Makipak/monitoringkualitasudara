#include "display.h"

#include <TFT_eSPI.h>

#include "../../include/thresholds.h"

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
//
// ROW_HEIGHT was 28 (8 rows: 7 params + temp only, humidity omitted since
// a 9th row would have collided with the WiFi/MQTT status line below);
// tightened to 24 to fit humidity as a 9th row. Computed from the
// TFT_eSPI default font's 12x16px glyph size at textSize(2), not measured
// on the physical ST7796 panel yet — re-check STATUS_ROW_Y/STATUS_COL_X
// against real hardware before treating this as final.
constexpr int ROW_HEIGHT = 24;
constexpr int ROW_TOP = 56;
constexpr int STATUS_COL_X = 340; // Normal/Tidak Normal label column, right
                                   // of the value+unit field (which ends by
                                   // ~x=280 at most, see printRow)
constexpr int STATUS_ROW_Y = 288; // 9 rows (7 params + temp + humidity) end
                                   // around y=248+16=264; leaves clear space
                                   // before this on a 320px-tall landscape screen

// `decimals` defaults to 1 (matches every row except NO2 below). NO2 gets
// 5 (see its call site) since its clamped range is only 0.1-10 ppm - at 1
// decimal, most real readings would round down to "0.1"/"0.0" and lose
// the actual formula output (e.g. 0.13027 -> "0.1"). Column width (8)
// stays fixed either way: it happens to fit both cases exactly (a 5-
// decimal NO2 value is at most "10.00000", 8 chars; smaller values like
// "0.13027" are 7, fitting with one leading space).
//
// `sensorIndex` is the row's index into thresholds.h's THRESHOLDS[]/
// SensorIndex (0..6) for one of the 7 official parameters — draws a
// Normal/Tidak Normal label in a fixed right-hand column, evaluated
// against thresholds.h's device-side ranges. This is the device's only
// out-of-range indicator (there is no LED anymore — see prd.md/
// architecture.md history; used to be firmware/src/display/led_alert.*).
// Pass -1 for a non-official row (Temp/Humidity — architecture.md 2.1
// "Catatan suhu ruangan" / schema.md 3.4: published/stored like the 7
// official parameters but deliberately excluded from threshold
// evaluation) to skip the label entirely rather than fabricate a status
// for it.
void printRow(int row, int sensorIndex, const char *label, float value,
              bool valid, const char *unit, int decimals = 1) {
  int y = ROW_TOP + row * ROW_HEIGHT;
  tft.setCursor(16, y);
  tft.printf("%-8s", label);
  if (valid) {
    tft.printf("%8.*f %s", decimals, value, unit);
  } else {
    tft.print("     --   ");
  }

  if (sensorIndex < 0) return;

  tft.setCursor(STATUS_COL_X, y);
  if (!valid) {
    tft.setTextColor(TFT_DARKGREY, TFT_BLACK);
    tft.print("--");
  } else if (thresholdOutOfRange(sensorIndex, value)) {
    tft.setTextColor(TFT_RED, TFT_BLACK);
    tft.print("TDK NORMAL");
  } else {
    tft.setTextColor(TFT_GREEN, TFT_BLACK);
    tft.print("NORMAL");
  }
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
}
} // namespace

void displayInit() {
  pinMode(TFT_RST, OUTPUT);
  digitalWrite(TFT_RST, LOW);
  delay(50);
  digitalWrite(TFT_RST, HIGH);
  delay(50);

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
  printRow(0, SENSOR_PM25, "PM2.5", readings.pm25, readings.valid[SENSOR_PM25], "ug/m3");
  printRow(1, SENSOR_PM10, "PM10", readings.pm10, readings.valid[SENSOR_PM10], "ug/m3");
  printRow(2, SENSOR_NO2, "NO2", readings.no2, readings.valid[SENSOR_NO2], "ppm", 5);
  printRow(3, SENSOR_CO2, "CO2", readings.co2, readings.valid[SENSOR_CO2], "ppm");
  printRow(4, SENSOR_TVOC, "TVOC", readings.tvoc, readings.valid[SENSOR_TVOC], "ppb");
  printRow(5, SENSOR_LUX, "Lux", readings.lux, readings.valid[SENSOR_LUX], "lux");
  printRow(6, SENSOR_NOISE, "Noise", readings.noiseDb, readings.valid[SENSOR_NOISE], "dB");

  // Room temperature + humidity (GY-SHT31) — published/stored like the 7
  // official parameters, but not one of them (architecture.md 2.1 "Catatan
  // suhu ruangan" / schema.md 3.4): shown visually distinct here too (grey,
  // no Normal/Tidak Normal column — sensorIndex -1) so they still read as
  // supporting info, not a monitored/alerted value. Both share one
  // validity flag (readings.sht31Valid) since they come from a single
  // atomic read (sht31Read()).
  tft.setTextColor(TFT_DARKGREY, TFT_BLACK);
  printRow(7, -1, "Temp", readings.roomTempC, readings.sht31Valid, "C");
  printRow(8, -1, "Humidity", readings.roomHumidityPct, readings.sht31Valid, "%RH");
  tft.setTextColor(TFT_WHITE, TFT_BLACK);

  tft.setCursor(16, STATUS_ROW_Y);
  tft.setTextColor(wifiConnected ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print(wifiConnected ? "WiFi: OK  " : "WiFi: --  ");
  tft.setTextColor(mqttConnected ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print(mqttConnected ? "MQTT: OK" : "MQTT: --");
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
}
