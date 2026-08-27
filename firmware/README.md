# firmware

ESP32 (DevKitC V4, WROOM-32D) firmware for the IoT device layer — see
`../architecture.md` section 2 for the full design.

## Setup

```sh
pip install platformio     # or use the PlatformIO IDE VS Code extension
cd firmware
cp include/secrets.h.example include/secrets.h
# edit include/secrets.h with real WiFi + HiveMQ Cloud credentials

pio run                                            # build (final ST7796 4.0" display)
pio run --target upload                            # flash (device connected via USB)
pio device monitor                                  # serial monitor, 115200 baud

# While the ST7796 4.0" unit is still in transit, bench-test with a
# temporary 2.4" ILI9341-family display instead (see "Hardware" below):
pio run -e esp32doit-devkit-v1-dev-display
pio run -e esp32doit-devkit-v1-dev-display --target upload
```

**NO2 (MiCS-4514) calibration monitoring:** `src/main.cpp` is temporarily
repurposed to only init I2C + the MiCS-4514 driver and print
`[NO2] ox=... red=... power=... power-ox=... ratio=...` in a tight loop
— no WiFi/MQTT/display/other sensors cluttering the serial monitor
during the hours-long burn-in (see `sensors/mics4514.cpp`'s calibration
procedure comment). The original
multi-sensor `main.cpp` is backed up at `src/main.cpp.bak` — restore it
(and delete the `.bak`) once `NO2_IS_CALIBRATED` is true in
`mics4514.cpp` and this device needs to run the real firmware again.

## Structure

```
include/
  config.h              pin map + timing constants
  thresholds.h           local (device-side) normal ranges per parameter
  secrets.h.example      copy to secrets.h (gitignored) before building
  User_Setup.h            TFT_eSPI config for the final ST7796 4.0" display
  User_Setup_Dev.h        TFT_eSPI config for the temporary bench-test display
src/
  main.cpp                setup()/loop() orchestration only
  sensors/                 one file per sensor, all read into a single SensorReadings struct
  network/                 WiFi + MQTT connection/publish
  display/                 TFT rendering, incl. per-parameter Normal/Tidak Normal label
```

Each sensor/network/display module only depends on `include/sensor_data.h`
(the shared struct) and its own libraries — not on each other — per
`../rule.md` section 3.

## Hardware (current, see architecture.md 2.1/2.2 for full change log)

7 official (alerted) parameters + 1 published-but-not-alerted value:

| Parameter | Sensor | Bus |
|---|---|---|
| PM2.5 / PM10 | SDS011 | UART1 |
| CO2 | MH-Z19B | UART2 |
| TVOC | GY-SGP30 | I2C |
| NO2 | MiCS-4514 | I2C |
| Lux | BH1750 | I2C |
| Noise | MAX9814 | ADC |
| Room temp + humidity (published + stored, excluded from thresholds/alerts) | GY-SHT31 | I2C |

Display: **ST7796 4.0" 480x320 SPI** (`TFT_eSPI`) is the official
component, replacing the originally planned ILI9341 2.8" — see
architecture.md 2.1 for the reasoning. That unit is still in transit as
of this writing, so firmware is being bench-tested in the meantime on a
temporary 2.4" ILI9341-family SPI display (same pins/library, different
driver macro + resolution — architecture.md 2.2). Use the
`esp32doit-devkit-v1-dev-display` PlatformIO environment for that; the
default environment always targets the final ST7796 config
(`include/User_Setup.h`). Once the ST7796 unit arrives and
`User_Setup.h` is verified against it, delete `User_Setup_Dev.h` and the
dev environment in `platformio.ini`.

SDS011 (replaces PMS5003) and MH-Z19B (replaces SCD30) were swapped in
after the originally planned sensors had seller pre-order lead times
that didn't fit the project deadline — pin allocations were rebudgeted
accordingly (see `include/config.h` comments).

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
- `src/sensors/mic_noise.cpp` — noise_db is uncalibrated relative loudness,
  not a certified SPL reading.
- `src/sensors/sds011.cpp` / `src/sensors/mhz19.cpp` — libraries
  (`SdsDustSensor`, `MH-Z19`) were picked as fast substitutions; re-check
  their maintenance status per `../rule.md` section 2 before relying on
  them for the real build.
- `src/network/mqtt_pub.cpp` — TLS uses `setInsecure()`; pin HiveMQ's root
  CA before the real demo/deployment (see comment in that file).
- `include/User_Setup.h` — `SPI_FREQUENCY` (27MHz) for the ST7796 over a
  remapped (non-native-VSPI) GPIO pinout is an untested starting point;
  tune once the actual wiring is on the bench.
- `include/User_Setup_Dev.h` / the `esp32doit-devkit-v1-dev-display` env
  — temporary, delete both once the ST7796 4.0" unit is confirmed working.
