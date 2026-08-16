# firmware

ESP32 (DevKitC V4, WROOM-32D) firmware for the IoT device layer — see
`../architecture.md` section 2 for the full design.

## Setup

```sh
pip install platformio     # or use the PlatformIO IDE VS Code extension
cd firmware
cp include/secrets.h.example include/secrets.h
# edit include/secrets.h with real WiFi + HiveMQ Cloud credentials
pio run                    # build
pio run --target upload    # flash (device connected via USB)
pio device monitor         # serial monitor, 115200 baud
```

## Structure

```
include/
  config.h          pin map + timing constants
  thresholds.h       local (device-side) normal ranges per parameter
  secrets.h.example  copy to secrets.h (gitignored) before building
  User_Setup.h        TFT_eSPI display config, injected via platformio.ini
src/
  main.cpp            setup()/loop() orchestration only
  sensors/            one file per sensor, all read into a single SensorReadings struct
  network/            WiFi + MQTT connection/publish
  display/            TFT rendering + LED threshold indicator
```

Each sensor/network/display module only depends on `include/sensor_data.h`
(the shared struct) and its own libraries — not on each other — per
`../rule.md` section 3.

## Known placeholders (update before relying on real readings)

- `include/thresholds.h` — normal ranges are placeholders pending the
  official standard reference (`../prd.md` section 8).
- `src/sensors/mics4514.cpp` — NO2 conversion factor is a placeholder;
  needs calibration against the datasheet/reference meter.
- `src/sensors/mic_noise.cpp` — noise_db is uncalibrated relative loudness,
  not a certified SPL reading.
- `src/network/mqtt_pub.cpp` — TLS uses `setInsecure()`; pin HiveMQ's root
  CA before the real demo/deployment (see comment in that file).
- `include/config.h` — only 7 of the 10 LEDs on the BOM are wired to
  GPIOs; the remaining 3 need an I2C GPIO expander or pin re-budget.
