// TEMPORARY TFT_eSPI setup for bench-testing with a 2.4" ILI9341-family
// SPI display while the final ST7796 4.0" unit is in transit — see
// architecture.md 2.2 "Catatan development sementara". Same pins/library
// as the final display (include/User_Setup.h); only the driver macro and
// resolution differ.
//
// This is NOT the official component decision — do not build/flash the
// default PlatformIO environment with this file. It's only pulled in by
// the `esp32doit-devkit-v1-dev-display` environment in platformio.ini,
// which exists purely as a local convenience for testing sensor/network
// code before the real display arrives. Delete this file (and the dev
// environment in platformio.ini) once the ST7796 unit is on the bench
// and User_Setup.h has been verified against it.

#define ILI9341_DRIVER
#define TFT_WIDTH 240
#define TFT_HEIGHT 320

#define TFT_MOSI 15 // matches config.h PIN_TFT_MOSI
#define TFT_MISO 4  // matches config.h PIN_TFT_MISO
#define TFT_SCLK 2  // matches config.h PIN_TFT_SCLK
#define TFT_CS 23   // matches config.h PIN_TFT_CS
#define TFT_DC 18   // matches config.h PIN_TFT_DC
#define TFT_RST 19  // matches config.h PIN_TFT_RST

#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4

#define SPI_FREQUENCY 27000000
