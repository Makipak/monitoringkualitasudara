// Custom TFT_eSPI setup for the ILI9341 2.8" SPI display, injected via
// PlatformIO build_flags (`-D USER_SETUP_LOADED=1 -include
// include/User_Setup.h`, see platformio.ini) instead of editing
// TFT_eSPI's own bundled User_Setup.h inside the library folder — keeps
// display config in this repo instead of a file PlatformIO would
// otherwise overwrite on every `pio lib update`.
//
// Pin values here MUST match include/config.h (PIN_TFT_*) — no single
// source of truth is possible because TFT_eSPI reads these as
// preprocessor macros, not runtime constants.

#define ILI9341_DRIVER

#define TFT_MISO 19
#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_CS 5   // matches config.h PIN_TFT_CS
#define TFT_DC 2   // matches config.h PIN_TFT_DC
#define TFT_RST 4  // matches config.h PIN_TFT_RST

#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4

#define SPI_FREQUENCY 40000000
