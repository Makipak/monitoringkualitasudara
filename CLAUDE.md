# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Udara** — Hospital Air Quality Monitoring System (tugas akhir). Monorepo with four sub-projects that talk to each other only via MQTT/REST over the internet, never directly (except `backend/` ↔ `ml-service/`, which talk over localhost only — see that section):

- `mobile/` — React Native (bare CLI, TypeScript) app. Display name "UF IAQ" (native identifiers unchanged, see the mobile/ section below).
- `firmware/` — PlatformIO/Arduino firmware for the ESP32 IoT device.
- `backend/` — Node.js (Express) MQTT subscriber + REST/WebSocket API + PostgreSQL (Supabase), per `architecture.md` section 4. Scaffolded and wired up to the mobile app; several pieces are still placeholders — see `backend/README.md` "Known placeholders".
- `ml-service/` — Python (FastAPI) microservice wrapping the trained BiGRU composite air-quality status classifier used by the mobile app's "Prediksi" tab. Called only by `backend/`, over `localhost`, never reachable from the internet or the mobile app directly. See the ml-service/ section below.

`design/` — a Claude Design prototype (`UF IAQ.dc.html` + its `_ds`/support asset bundle) the user imported as the visual reference for the mobile app's UI. It is a static HTML mockup with fake/generated data, not runnable app code — don't execute or serve it; read it for layout/copy/color reference when touching `mobile/src/screens/` or `components/`. Its own "Prediksi" tab mockup assumed a richer model (per-parameter forecasts + a future trend chart) than what was actually trained — the real BiGRU classifier only outputs a composite status label + per-class probabilities, so `PredictionScreen.tsx` intentionally diverges from that mockup's layout to show real model output instead (see that file's top-of-file comment).

**Read these before making non-trivial changes** — they are the source of truth for requirements/design/rules, not this file:

- `prd.md` — product requirements, scope, open questions.
- `architecture.md` — full system design (device/broker/backend/app layers), including code examples for MQTT publish/subscribe.
- `schema.md` — PostgreSQL schema (tables, indexes, example queries).
- `rule.md` — mandatory conventions: no deprecated/unmaintained dependencies, credentials only via env vars/gitignored files (never hardcoded or committed), single-responsibility modules, no emoji in docs, magic numbers must be named constants, thresholds centralized in one file.

Several things are explicitly undecided (see "Open Questions" in `prd.md` and `architecture.md` section 9) — don't assume a final answer for user roles/auth, data retention policy, or `socket.io` vs `ws` unless the user has stated a decision in this conversation (the backend currently uses `ws`, matching `architecture.md`'s own recorded v1 default — that's not the same as the "final" choice being settled).

The rule-based/ML split: per-parameter alerts and recommendations (`architecture.md` 4.2a, `backend/src/services/threshold.js`) are and remain **rule-based** — that decision is unchanged, don't replace `threshold.js` without the user confirming otherwise. Separately, the composite "Prediksi" status shown on the mobile app's Prediksi tab and Dashboard AI pill **is now wired to a real trained model** — a BiGRU classifier (`ml-service/`, called from `backend/src/services/ml.js`) that outputs one of 4 composite labels (Baik/Rawan/Peringatan/Bahaya) + per-class probabilities from the last 60 sensor readings. It fails safe (no prediction produced, not a guess) whenever a full window of complete readings isn't available — currently true on the real device, since the CO2, lux, temperature, and humidity sensors are physically uninstalled pending hardware repair (as of this writing). A longer-term ML-based *recommendation* system (replacing/augmenting `threshold.js` itself) is still undecided — don't conflate the two.

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
- `mobile/src/navigation/RootNavigator.tsx` — single source of truth for routes. Bottom tabs (`RootTabParamList`: Beranda/Prediksi/Riwayat/Tentang, `@react-navigation/bottom-tabs`) with a nested native-stack (`HomeStackParamList`: Dashboard/ParameterDetail) inside the Beranda tab, matching `design/UF IAQ.dc.html`'s isHome/isDetail toggle. v1 scope is a single device/room (`prd.md` section 3) — Beranda shows one room's dashboard directly, no device list/picker; don't reintroduce a multi-device screen without the user confirming that scope changed. New screens go in the relevant param list here AND the matching Navigator/Tab.Screen so `navigation.navigate(...)` stays type-checked. Per-tab icon components must stay module-level functions (not inline arrows in `screenOptions`) — see the `react/no-unstable-nested-components` comment in this file.
- `mobile/src/screens/` — one file per screen (`DashboardScreen`, `ParameterDetailScreen`, `PredictionScreen`, `HistoryScreen`, `AboutScreen`). Screens import their prop types via `HomeStackScreenProps<'ScreenName'>`/`RootTabScreenProps<'ScreenName'>` from `RootNavigator.tsx` rather than typing props by hand. Screens stay presentational — data fetching/subscriptions live in `hooks/`, not here (rule.md section 7). `PredictionScreen.tsx` now shows real output from the trained BiGRU classifier via `hooks/usePrediction.ts` (`GET /api/rooms/:deviceId/prediction` + the WebSocket `prediction` message) — composite status label + per-class probabilities only, since that's all the model actually produces; it explicitly renders a distinct "not available yet" state (not a fabricated number) whenever a full 60-reading window with every sensor present isn't there yet, which is the current real state of the device (CO2/lux/temperature/humidity sensors uninstalled pending repair). `DashboardScreen.tsx`'s "Prediksi AI" pill uses the same real data via the same hook.
- `mobile/src/hooks/useSensorData.ts` — fetches `/api/rooms/:deviceId/latest` + `/status` on mount and subscribes to the WebSocket for live updates (Dashboard). `useParameterHistory.ts` — fetches `/api/rooms/:deviceId/history` for one parameter over a chosen lookback window (ParameterDetail's chart/stats). Screens get sensor data only through these.
- `mobile/src/components/` — small presentational pieces shared across screens: `CircularGauge` (SVG ring gauge), `SectionHeader`, `RangeSelector` (segmented time-range buttons), `Chip` (filter pill), `ParameterRow` (dashboard list row), `TrendChart` (SVG line chart, fed real `/history` values), `Icon` (renders a Lucide-style path via `react-native-svg`).
- `mobile/src/constants/parameters.ts` — the 7 official parameters with display metadata (name/unit/icon), single source of truth so screens don't repeat this list; matches `backend/src/config.js` `OFFICIAL_PARAMETERS`.
- `mobile/src/utils/iaqScore.ts` — the home screen's composite "IAQ score" gauge is a placeholder heuristic (percentage of parameters currently "normal"), not an official metric — there is no defined scoring formula in `schema.md`/`architecture.md`/`prd.md`. Don't treat its output as authoritative without the user confirming a real formula has been decided.
- `mobile/src/theme.ts` — design tokens (colors, status tone lookup) ported from `design/UF IAQ.dc.html`; screens/components should pull from here rather than repeating hex literals.
- `mobile/src/services/` — `api.ts` (REST calls, JWT token caching) and `socket.ts` (WebSocket client) per `architecture.md` section 6.2; `notifications.ts` (FCM) still not implemented. The mobile app only ever talks to `backend/`, never to MQTT/the device directly.
- `mobile/src/config/env.ts` (gitignored, copy from `env.example.ts`) — backend `API_BASE_URL` (must be the backend host's LAN IP, not `localhost`, for a physical device — unless tunneled over USB with `adb reverse`, needed on networks with AP/Client Isolation enabled), the placeholder `APP_ACCESS_KEY` (must match `backend/.env`), and `DEFAULT_DEVICE_ID` (`"room-01"`).

Fonts: `design/UF IAQ.dc.html` uses Google Fonts "Archivo" via a `<link>` tag, which only works in a browser — React Native has no CSS `@font-face` equivalent without bundling `.ttf` files as native assets and relinking. `mobile/src/theme.ts`'s `FONT_FAMILY` falls back to the platform system font; this is a known simplification, not a bug.

Android/iOS native project identifiers: Android package `com.udaraapp`; iOS bundle id is still the template default `org.reactjs.native.example.$(PRODUCT_NAME)` in `mobile/ios/UdaraApp.xcodeproj/project.pbxproj` and should be updated before any real device testing or store submission.

Config files (`babel.config.js`, `metro.config.js`, `jest.config.js`, `tsconfig.json`, `.eslintrc.js`) are all unmodified `@react-native/*` presets — no custom aliasing, transforms, or lint rules have been added.

## backend/ (Node.js)

```sh
cd backend
npm install
cp .env.example .env             # fill in real HiveMQ/Supabase creds, gitignored

psql "$DATABASE_URL" -f sql/schema.sql   # run once against Supabase
psql "$DATABASE_URL" -f sql/seed.sql      # seeds the v1 "room-01" device/room row

npm start          # node src/index.js
npm run dev          # node --watch src/index.js
```

### Architecture

- `backend/src/config.js` — every env var and cross-cutting constant (rule.md 3); no magic numbers/literals scattered across other files.
- `backend/src/validate.js` — structural/range sanity check on raw MQTT payloads before they touch the database (`architecture.md` section 7); separate from `services/threshold.js`'s normal-range evaluation.
- `backend/src/services/mqtt.js` — subscribes to `hospital/+/sensors` on HiveMQ Cloud (TLS, cert verified) and runs the ingest pipeline per message: validate → resolve device → store reading → evaluate thresholds → update `alerts` (open/resolve) → broadcast over WebSocket → run the composite-status prediction step (see `services/ml.js` below), wrapped so an ml-service outage never breaks the core pipeline.
- `backend/src/services/db.js` — all PostgreSQL access (Supabase); other modules never query the DB directly.
- `backend/src/services/threshold.js` — pure rule-based evaluation against the `thresholds` table + fixed recommendation text (`architecture.md` 4.2a); this is unchanged and stays authoritative for alerts/recommendations — see the "rule-based/ML split" note above.
- `backend/src/services/ml.js` — pure request-building/calling logic for `ml-service/`'s BiGRU classifier (mirrors `threshold.js`'s pure-module style). `buildWindowPayload()` is the fail-safe gate: returns `null` (skip, don't call the model) unless the last `ML_PREDICTION_WINDOW_SIZE` (60) `sensor_readings` rows are all fully populated — this is what makes the currently-uninstalled CO2/lux/temperature/humidity sensors safely stall predictions rather than corrupt them, with no special-casing needed once the hardware is back.
- `backend/src/services/ws.js` — native `ws` broadcast (the v1 choice recorded in `architecture.md` 4.4) to app clients connected at `/ws`; broadcasts both `sensor_reading` and `prediction` messages.
- `backend/src/middleware/auth.js` + `backend/src/routes/auth.js` — JWT gate on the REST API (rule.md 6). `APP_ACCESS_KEY` is a single shared secret standing in for real per-user login until user roles are decided (`prd.md` Open Questions) — don't build multi-role auth on top of this without the user confirming that decision.
- `backend/src/routes/rooms.js` — the REST endpoints from `architecture.md` 4.3 (`latest`, `history`, `export`, `status`) plus `prediction` (latest composite-status result; `{ available: false }`, not a 404, while the sensor set is incomplete).
- `backend/sql/schema.sql` — mirrors `schema.md` table-for-table; `backend/sql/seed.sql` seeds only the v1 device/room row, deliberately not `thresholds` (final standard values are an open question, see `prd.md` section 8) — until threshold rows exist, `evaluateThresholds()` fails safe and raises no alerts.

See `backend/README.md` "Known placeholders" for what's stubbed (push notification/FCM, DB TLS cert pinning, export file format, data retention).

## ml-service/ (Python)

```sh
cd ml-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn app:app --reload --port 8001
```

### Architecture

- `ml-service/app.py` — FastAPI app, `POST /predict` + `GET /health`. Loads the model/scaler/metadata once at startup (fails fast if any are missing/broken). Reconstructs the model via `model_from_json()` + `set_weights()` — it was saved as a plain dict, not with Keras's own `save()`/`load_model()` — and loads the scaler with `joblib.load` (not plain `pickle.load`).
- `ml-service/metadata.json` — single source of truth for `feature_cols` order (9 features), `window` (60), and `label_map` (0-3 → Baik/Rawan/Peringatan/Bahaya). `backend/src/services/ml.js`'s `ML_PREDICTION_WINDOW_SIZE` constant must be kept in sync with `window` by hand.
- `bigru_model_<timestamp>.pkl` + `scaler_<timestamp>.pkl` — must always be from the same training run (the scaler's fitted stats only make sense for the model trained on that data); if you retrain, keep both filenames in sync or update `MODEL_PATH`/`SCALER_PATH` in `app.py` together.
- Real open risk, not yet resolved: the scaler's fitted `no2` mean (33.4) is ~1600x `architecture.md`'s example `no2` payload value (0.02 ppm) — training data's `no2` unit likely doesn't match what the live MiCS-4514 sensor reports. See `ml-service/README.md` "Known placeholders" before trusting live NO2-influenced predictions.
- Only ever called by `backend/src/services/ml.js` over `http://127.0.0.1:<port>/predict` (see `backend/src/config.js` `ML_SERVICE_URL`) — never exposed publicly, no auth on its endpoints (acceptable only because it's localhost-only).

## firmware/ (PlatformIO / ESP32)

```sh
cd firmware
cp include/secrets.h.example include/secrets.h   # fill in real WiFi/MQTT creds, gitignored

pio run                       # build (default env = final ST7796 4.0" display)
pio run --target upload        # flash over USB
pio device monitor             # serial monitor, 115200 baud

# Temporary bench-test env (2.4" ILI9341-family display) while the ST7796
# 4.0" unit is in transit — see `firmware/README.md` "Hardware":
pio run -e esp32doit-devkit-v1-dev-display
```

### Architecture

- `firmware/include/config.h` — every pin assignment and timing interval as a named constant (rule.md 5); check here first when wiring changes.
- `firmware/include/thresholds.h` — local, device-side normal ranges for the 7 official parameters, used only to drive the on-screen "Normal"/"Tidak Normal" label (`firmware/src/display/display.cpp`) so it keeps working when the device is offline from the broker (`architecture.md` 2.2). There is no physical LED indicator — that was the original v1 plan (10x LED, `architecture.md` 2.1) but was dropped in favor of the on-screen label alone; don't reintroduce LED code/wiring without the user confirming that decision reversed. This threshold table is separate from the server-side `thresholds` table in `schema.md`, which is the source of truth for history/notifications/rule-based recommendations (`architecture.md` 4.2a).
- `firmware/include/secrets.h` (gitignored, copy from `secrets.h.example`) — WiFi + HiveMQ Cloud credentials. Never hardcode these directly in `.cpp` files or commit real values.
- `firmware/include/User_Setup.h` — TFT_eSPI display pin/driver config for the **official** ST7796 4.0" 480x320 display (replaces the originally planned ILI9341 2.8" — see `architecture.md` 2.1), injected via `-include` in the default `platformio.ini` env rather than editing the library's bundled copy (which `pio lib update` would overwrite). `firmware/include/User_Setup_Dev.h` is a **temporary** sibling config for bench-testing with a 2.4" ILI9341-family display while the ST7796 unit is in transit (`architecture.md` 2.2) — only used by the separate `esp32doit-devkit-v1-dev-display` PlatformIO env; delete both once the ST7796 unit is confirmed working.
- `firmware/src/sensors/` — one file pair per sensor: SDS011 (PM2.5/PM10, UART1, replaces PMS5003), MH-Z19B (CO2, UART2, replaces SCD30), SGP30 (TVOC, I2C), MiCS-4514 (NO2, I2C), BH1750 (lux, I2C), MAX9814-based noise (ADC). SDS011/MH-Z19B replaced the originally planned sensors due to seller pre-order lead times (`architecture.md` 2.1) — pin budget was rebudgeted accordingly in `config.h`. Each reads into the shared `SensorReadings` struct (`include/sensor_data.h`) via `sensors.h`'s `sensorsRead()`. Sensor code has no knowledge of display or network. GY-SHT31 (room temperature, I2C) is also read here — it IS published over MQTT and persisted like the 7 official parameters, but is deliberately excluded from threshold evaluation and status-label/alert triggering (see the warning comment on `SensorReadings::roomTempC`); don't wire it into those paths without also updating `prd.md` (new FR) and `schema.md` 3.4.
- `firmware/src/network/` — `wifi_conn.*` and `mqtt_pub.*`. Both expose non-blocking `*Maintain()` functions called every `loop()` iteration; actual reconnect attempts are internally rate-limited by the intervals in `config.h`. `mqttPublishReadings()` serializes `SensorReadings` (7 official parameters + `temperature`) to the JSON shape defined in `architecture.md` 2.3 and publishes to `hospital/{DEVICE_ID}/sensors`.
- `firmware/src/display/` — `display.*` (TFT rendering, including the per-parameter "Normal"/"Tidak Normal" label evaluated against `thresholds.h` — the device's only out-of-range indicator, there is no LED), kept as a separate concern from sensor reading (rule.md 3).
- `firmware/src/main.cpp` — `setup()`/`loop()` orchestration only; no sensor/display/network logic lives here directly.

See `firmware/README.md` "Known placeholders" for values that are stand-ins (NO2 conversion factor, noise calibration, on-screen status-label thresholds, TLS cert pinning) and must be revisited before treating firmware output as trustworthy.
