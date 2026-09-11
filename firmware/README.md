# firmware

Firmware for the IoT device layer — see `../architecture.md` section 2
for the full design. **Two parallel PlatformIO board targets** build from
this same `src/`/`include/` tree (env-specific pins/libraries are
resolved at compile time, see "Board targets" below):

- `esp32doit-devkit-v1` (default) — ESP32 DevKitC V4 (WROOM-32D) +
  `TFT_eSPI`. The original product decision (architecture.md 2.1).
- `esp32-s3-devkitc-1` — ESP32-S3 (N16R8) + `GFX Library for Arduino`.
  Ported in from an Arduino IDE bring-up sketch
  (`firmware/arduino_ide/UdaraS3/UdaraS3.ino`, now decomposed into this
  project — that sketch folder no longer exists).

## Setup

```sh
pip install platformio     # or use the PlatformIO IDE VS Code extension
cd firmware
cp include/secrets.h.example include/secrets.h
# edit include/secrets.h with real WiFi + HiveMQ Cloud credentials

pio run                                            # build (default: ESP32 DevKitC V4, final ST7796 4.0" display)
pio run --target upload                            # flash (device connected via USB)
pio device monitor                                  # serial monitor, 115200 baud

# ESP32-S3 target (explicit opt-in, see "Board targets" below):
pio run -e esp32-s3-devkitc-1
pio run -e esp32-s3-devkitc-1 --target upload

# While the ST7796 4.0" unit was still in transit, bench-testing used a
# temporary 2.4" ILI9341-family display on the ESP32 DevKitC V4 target
# instead (see "Hardware" below):
pio run -e esp32doit-devkit-v1-dev-display
pio run -e esp32doit-devkit-v1-dev-display --target upload
```

## Board targets

Both `[env]`s in `platformio.ini` share the same `src/`/`include/` tree.
Two things differ per board and are resolved at compile time, not by
duplicating the whole tree:

- **Pins** — `include/config.h` has one `#if CONFIG_IDF_TARGET_ESP32S3 /
  #else` block covering every pin constant (I2C, UART, ADC, TFT). This
  macro is set automatically by the Arduino-ESP32/ESP-IDF core based on
  which board a PlatformIO env targets — no manual build flag needed.
- **Display library** — `TFT_eSPI` (DevKitC V4) and `GFX Library for
  Arduino` (S3) are different libraries with different APIs, so there are
  two backend files implementing the same `src/display/display.h`
  interface: `display_tftespi.cpp` and `display_gfx.cpp`. Each
  `[env]`'s `build_src_filter` in `platformio.ini` excludes the other
  board's backend file, so only one graphics library is ever a build
  dependency per env. Shared colors/layout constants for both live in
  `src/display/dispenser_theme.h`.

MiCS-4514 (NO2) also differs slightly: on the ESP32-S3 target it gets its
own dedicated I2C bus (`Wire1`) instead of sharing the main bus — found
necessary during ESP32-S3 bring-up (see `src/sensors/mics4514.cpp`).
Selected the same way, via `CONFIG_IDF_TARGET_ESP32S3`.

**Not yet build-verified against real hardware in every environment this
was edited in** — the `esp32-s3-devkitc-1` env's `board_build.*`
flash/PSRAM settings (16MB flash / 8MB octal PSRAM) are a best-effort N16R8
config, not confirmed with an actual `pio run` here. Re-check on a real
build before trusting it blindly.

## Structure

```
include/
  config.h              pin map (per-board #if block) + timing constants
  thresholds.h           local (device-side) normal ranges per parameter
  secrets.h.example      copy to secrets.h (gitignored) before building
  User_Setup.h            TFT_eSPI config for the ESP32 DevKitC V4 target's final ST7796 4.0" display
  User_Setup_Dev.h        TFT_eSPI config for that target's temporary bench-test display
src/
  main.cpp                setup()/loop() orchestration only, board-agnostic
  sensors/                 one file per sensor, all read into a single SensorReadings struct
  network/                 WiFi + MQTT connection - publishes sensor readings
                            (hospital/{DEVICE_ID}/sensors) and subscribes to
                            the composite-status prediction the backend
                            publishes back (hospital/{DEVICE_ID}/prediction)
  display/                 display.h (shared interface) + dispenser_theme.h
                            (shared colors/layout) + two backends
                            (display_tftespi.cpp, display_gfx.cpp — see
                            "Board targets" above): card-based UI with
                            color-coded parameter values (green/red per
                            thresholds.h) + the AI-prediction card
                            (Baik/Rawan/Peringatan/Bahaya)
```

Each sensor/network/display module only depends on `include/sensor_data.h`
(the shared struct) and its own libraries — not on each other — per
`../rule.md` section 3.

## Hardware (current, see architecture.md 2.1/2.2 for full change log)

7 official (alerted) parameters + 1 published-but-not-alerted value:

| Parameter | Sensor | Bus |
|---|---|---|
| PM2.5 / PM10 | SDS011 | UART1 |
| CO2 | Winsen MH-Z19C (NDIR) | UART2 |
| TVOC | GY-SGP30 | I2C |
| NO2 | MiCS-4514 | I2C (own dedicated bus on the ESP32-S3 target, see "Board targets") |
| Lux | BH1750 | I2C |
| Noise | MAX9814 | ADC |
| Room temp + humidity (published + stored, excluded from thresholds/alerts) | GY-SHT31 | I2C |

Display: **ST7796 4.0" 480x320 SPI** is the official component on both
board targets, replacing the originally planned ILI9341 2.8" — see
architecture.md 2.1 for the reasoning. The ESP32 DevKitC V4 target drives
it via `TFT_eSPI`; the ESP32-S3 target via `GFX Library for Arduino` (see
"Board targets" above) — same panel, different library/wiring per board.
The ESP32 DevKitC V4 target also has a temporary 2.4" ILI9341-family
bench-test config (same pins/library, different driver macro +
resolution — architecture.md 2.2) for use while the ST7796 4.0" unit was
in transit; use the `esp32doit-devkit-v1-dev-display` PlatformIO
environment for that.

SDS011 (replaces PMS5003) and the CO2 module (replaces SCD30) were
swapped in after the originally planned sensors had seller pre-order lead
times that didn't fit the project deadline — pin allocations were
rebudgeted accordingly (see `include/config.h` comments). The CO2 module
was originally sourced as a Winsen MH-Z19B; the physical unit that
actually arrived was a Huiwen MWD1006 instead (protocol-compatible NDIR
module, different vendor/model) — that unit later stopped working and
was replaced (2026-09-01) with a genuine Winsen **MH-Z19C** (see the
`mhz19c.cpp` entry below).

## Known placeholders (update before relying on real readings)

- `include/thresholds.h` — normal ranges are placeholders pending the
  official standard reference (`../prd.md` section 8).
- `src/sensors/mics4514.cpp` — **protocol corrected 2026-08-26.** This
  physical board turned out to speak DFRobot's `DFRobot_MICS` register
  protocol (github.com/DFRobot/DFRobot_MICS), not Seeed's
  `Multichannel_Gas_GMXXX` command protocol, despite being wired/sold as
  a Seeed Grove Multichannel Gas Sensor v2 board. Found after an
  extended bring-up investigation: the board's I2C address (`0x75`)
  matched DFRobot's documented `MICS_ADDRESS_0` exactly (not Seeed's
  documented default of `0x08`), and directly testing DFRobot's register
  read sequence produced live, drifting OX/RED values (real heater
  warm-up behavior) where Seeed's own command protocol only ever
  produced a frozen value on every channel but one. The sensor was never
  dead - see git history / firmware/src/sensors/mics4514.cpp for the
  prior (wrong) Seeed-based implementation if this ever needs
  cross-referencing. Current code reimplements DFRobot's register
  protocol directly (no library dependency needed for just this one
  channel) and uses DFRobot's own published NO2 ratio-to-ppm formula -
  this is now the board's actual native formula, not a cross-vendor
  approximation. `NO2_R0_PLACEHOLDER` is now a real measured baseline
  (~3.2hr outdoor burn-in, see the comment above that constant in
  `mics4514.cpp` for the measurement conditions/date) - `NO2_IS_CALIBRATED`
  is `true`. Still a single-point field calibration against ambient
  outdoor air, not a lab/reference-gas calibration - treat ppm as
  indicative, not certified-precise. Re-measure (per-unit) if the sensor
  is ever replaced.
- `src/sensors/mhz19c.cpp` (renamed from `mwd1006.cpp` 2026-09-01) — CO2
  module history on this pin: originally sourced as a Winsen MH-Z19B, the
  unit that actually arrived (2026-08-27 bring-up) turned out to be a
  Huiwen MWD1006 instead (found after a "CO2 always reads 0"
  investigation — its module answers 0 for the `wifwaf/MH-Z19` library's
  default `getCO2()` command 0x85 "CO2 unlimited" without raising a comms
  error; fixed at the time by calling `getCO2(false)`, command 0x86). That
  MWD1006 unit later stopped working and was replaced (2026-09-01) with a
  genuine Winsen **MH-Z19C** — verified against Winsen's own MH-Z19C
  datasheet (v1.0, 2020.02.04) that the UART framing, the 0x86
  read-concentration command + checksum algorithm, and the 0x79 ABC
  on/off command are all byte-for-byte what this driver already sends, so
  no protocol code changes were needed, `getCO2(false)` is kept (0x86 is
  the only read-concentration command the MH-Z19C datasheet documents).
  Not yet field-confirmed against a live reading on the real device (only
  datasheet-verified so far) — update this note once it has been. Preheat
  per the MH-Z19C datasheet is 1 minute (T90 < 120s), faster than the old
  MWD1006 unit's ~2 minute spec; no explicit firmware warm-up delay either
  way.
- `src/sensors/mic_noise.cpp` — noise_db is uncalibrated relative loudness,
  not a certified SPL reading.
- `src/sensors/sds011.cpp` — library (`SdsDustSensor`) was picked as a
  fast substitution; re-check its maintenance status per `../rule.md`
  section 2 before relying on it for the real build.
- `src/network/mqtt_pub.cpp` — TLS uses `setInsecure()`; pin HiveMQ's root
  CA before the real demo/deployment (see comment in that file).
- `include/User_Setup.h` — `SPI_FREQUENCY` (27MHz) for the ST7796 over a
  remapped (non-native-VSPI) GPIO pinout is an untested starting point;
  tune once the actual wiring is on the bench.
- `include/User_Setup_Dev.h` / the `esp32doit-devkit-v1-dev-display` env
  — temporary, delete both once the ST7796 4.0" unit is confirmed working.
- `[env:esp32-s3-devkitc-1]` (`platformio.ini`) — `board_build.*`
  flash/PSRAM settings for the N16R8 module (16MB flash / 8MB octal PSRAM)
  are a best-effort config, not confirmed with a real `pio run` (see
  "Board targets" above). Re-check before trusting the build blindly.
- `src/sensors/mics4514.cpp` (ESP32-S3 target) — the dedicated `Wire1` bus
  for MiCS-4514 was carried over from the ESP32-S3 bring-up sketch as a
  fix for the chip's interface controller going to sleep when several I2C
  sensors were `begin()`'d together on one shared bus; not yet re-verified
  against this decomposed/modular build specifically (only against the
  original monolithic bring-up sketch).
- `src/sensors/sgp30.cpp` `sgp30SetHumidity()` — humidity compensation
  ported from the bring-up sketch; improves TVOC accuracy in principle
  (Sensirion SGP30 datasheet) but not yet A/B-verified against readings
  without it on this project's real sensors.
- `platformio.ini` `[env:esp32-s3-devkitc-1]` `lib_deps` —
  `moononournation/GFX Library for Arduino@^1.4.9` — registry name/owner
  and the `Arduino_ESP32SPI`/`Arduino_ST7796`/`Arduino_GFX` constructor
  and drawing-method signatures used in `display_gfx.cpp` (`begin()`,
  `getTextBounds()`, `fillRoundRect()`, etc.) were all checked directly
  against the library's GitHub source (latest release at the time: 1.6.7,
  well above the `^1.4.9` floor here). Still not build-verified with an
  actual `pio run` in this sandbox (`pio` CLI is broken here, see below).
