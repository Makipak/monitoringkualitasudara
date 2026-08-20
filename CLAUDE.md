# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Udara** — Hospital Air Quality Monitoring System (tugas akhir). Monorepo with two sub-projects that talk to each other only via MQTT/REST over the internet, never directly:

- `mobile/` — React Native (bare CLI, TypeScript) app.
- `firmware/` — PlatformIO/Arduino firmware for the ESP32 IoT device.

A third piece, the Node.js backend (MQTT subscriber + REST/WebSocket API + PostgreSQL via Supabase), is planned per `architecture.md` but not yet scaffolded in this repo.

**Read these before making non-trivial changes** — they are the source of truth for requirements/design/rules, not this file:

- `prd.md` — product requirements, scope, open questions.
- `architecture.md` — full system design (device/broker/backend/app layers), including code examples for MQTT publish/subscribe.
- `schema.md` — PostgreSQL schema (tables, indexes, example queries).
- `rule.md` — mandatory conventions: no deprecated/unmaintained dependencies, credentials only via env vars/gitignored files (never hardcoded or committed), single-responsibility modules, no emoji in docs, magic numbers must be named constants, thresholds centralized in one file.

Several things are explicitly undecided (see "Open Questions" in `prd.md` and `architecture.md` section 9) — don't assume a final answer for user roles/auth, the ML recommendation system, data retention policy, or `socket.io` vs `ws` unless the user has stated a decision in this conversation.

## mobile/ (React Native)

```sh
cd mobile
npm install                 # run this first — node_modules is not committed

npm start                    # start Metro bundler
npm run android               # build + run on Android (device/emulator must be running)
npm run ios                   # build + run on iOS (device/simulator must be running, macOS only)

npm test                      # run Jest tests
npx jest path/to/file.test.tsx          # run a single test file
npx jest -t "test name substring"        # run tests matching a name

npm run lint                  # ESLint (@react-native config)
npx tsc --noEmit               # type-check without emitting
```

iOS also requires CocoaPods before the first build or after adding a native dependency:

```sh
cd mobile/ios && bundle install && bundle exec pod install && cd ../..
```

### Architecture

Bare React Native CLI project (not Expo) with TypeScript and the New Architecture template (`0.87.0`), so native module changes go directly through `mobile/android/` (Kotlin) and `mobile/ios/` (Swift) — there is no Expo config-plugin layer.

- `mobile/index.js` — entry point. `react-native-gesture-handler` must stay the very first import here (required transitively by React Navigation's native-stack); don't reorder it.
- `mobile/App.tsx` — root component. Wraps everything in `SafeAreaProvider` and renders `RootNavigator`. Keep this file thin; screen/navigation logic belongs in `mobile/src/`.
- `mobile/src/navigation/RootNavigator.tsx` — single source of truth for routes. `RootStackParamList` defines every screen's params; new screens must be added to this type and to the `Stack.Navigator` here so `navigation.navigate(...)` stays type-checked. Uses `@react-navigation/native-stack`.
- `mobile/src/screens/` — one file per screen. Screens import their prop types via `RootStackScreenProps<'ScreenName'>` from `RootNavigator.tsx` rather than typing props by hand.
- `mobile/src/services/` — planned home for API/WebSocket/notification logic (per `architecture.md` section 6.2: `api.ts`, `socket.ts`, `notifications.ts`), kept separate from UI. Not implemented yet — no backend exists to call.

Android/iOS native project identifiers: Android package `com.udaraapp`; iOS bundle id is still the template default `org.reactjs.native.example.$(PRODUCT_NAME)` in `mobile/ios/UdaraApp.xcodeproj/project.pbxproj` and should be updated before any real device testing or store submission.

Config files (`babel.config.js`, `metro.config.js`, `jest.config.js`, `tsconfig.json`, `.eslintrc.js`) are all unmodified `@react-native/*` presets — no custom aliasing, transforms, or lint rules have been added.

## firmware/ (PlatformIO / ESP32)

```sh
cd firmware
cp include/secrets.h.example include/secrets.h   # fill in real WiFi/MQTT creds, gitignored
pio run                      # build
pio run --target upload       # flash over USB
pio device monitor            # serial monitor, 115200 baud
```

### Architecture

- `firmware/include/config.h` — every pin assignment and timing interval as a named constant (rule.md 5); check here first when wiring changes.
- `firmware/include/thresholds.h` — local, device-side normal ranges per parameter, used only to drive the instant LED indicator so it keeps working when the device is offline from the broker (`architecture.md` 2.2). This is separate from the server-side `thresholds` table in `schema.md`, which is the source of truth for history/notifications.
- `firmware/include/secrets.h` (gitignored, copy from `secrets.h.example`) — WiFi + HiveMQ Cloud credentials. Never hardcode these directly in `.cpp` files or commit real values.
- `firmware/include/User_Setup.h` — TFT_eSPI display pin/driver config (ST7796 4.0" 480x320, replaces the originally planned ILI9341 2.8" — see `architecture.md` 2.1), injected via `-include` in `platformio.ini` rather than editing the library's bundled copy (which `pio lib update` would overwrite).
- `firmware/src/sensors/` — one file pair per sensor: SDS011 (PM2.5/PM10, UART1, replaces PMS5003), MH-Z19B (CO2, UART2, replaces SCD30), SGP30 (TVOC, I2C), MiCS-4514 (NO2, I2C), BH1750 (lux, I2C), MAX9814-based noise (ADC). SDS011/MH-Z19B replaced the originally planned sensors due to seller pre-order lead times (`architecture.md` 2.1) — pin budget was rebudgeted accordingly in `config.h`. Each reads into the shared `SensorReadings` struct (`include/sensor_data.h`) via `sensors.h`'s `sensorsRead()`. Sensor code has no knowledge of display or network. GY-SHT31 (room temperature, I2C) is also read here but is display-only — deliberately excluded from MQTT publish, persistence, and threshold evaluation (see the warning comment on `SensorReadings::roomTempC`); don't wire it into those paths without also updating `prd.md`/`schema.md`.
- `firmware/src/network/` — `wifi_conn.*` and `mqtt_pub.*`. Both expose non-blocking `*Maintain()` functions called every `loop()` iteration; actual reconnect attempts are internally rate-limited by the intervals in `config.h`. `mqttPublishReadings()` serializes `SensorReadings` to the JSON shape defined in `architecture.md` 2.3 and publishes to `hospital/{DEVICE_ID}/sensors`.
- `firmware/src/display/` — `display.*` (TFT rendering) and `led_alert.*` (per-parameter red LED, evaluated against `thresholds.h`), kept as separate concerns from sensor reading (rule.md 3).
- `firmware/src/main.cpp` — `setup()`/`loop()` orchestration only; no sensor/display/network logic lives here directly.

See `firmware/README.md` "Known placeholders" for values that are stand-ins (NO2 conversion factor, noise calibration, LED thresholds, TLS cert pinning) and must be revisited before treating firmware output as trustworthy.
