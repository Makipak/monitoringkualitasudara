# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Udara** — Hospital Air Quality Monitoring System (tugas akhir). Monorepo with four sub-projects that talk to each other only via MQTT/REST over the internet, never directly (except `backend/` ↔ `ml-service/`, which talk over localhost only — see that section):

- `mobile/` — React Native (bare CLI, TypeScript) app. Display name "Falhora" — Faletehan Hospital Indoor Air Quality (renamed from "BHIAQ"/"Banten Hospital Indoor Air Quality" 2026-09-11, display name and logo only — native identifiers unchanged, see the mobile/ section below).
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
- `mobile/src/hooks/useSensorData.ts` — fetches `/api/rooms/:deviceId/latest` + `/status` on mount and subscribes to the WebSocket for live updates (Dashboard). `useParameterHistory.ts` — fetches `/api/rooms/:deviceId/history` for one parameter over a chosen lookback window (ParameterDetail's chart/stats). `useExport.ts` — downloads today's `.../export?format=xlsx|pdf` file (`react-native-blob-util`, native file I/O — global `fetch()` can't write to disk) and hands it to the OS to open (HistoryScreen's two download buttons). `react-native-blob-util@0.24.10`'s Android download path has an upstream bug — `ReactNativeBlobUtilFileResp`'s progress-reporting `Source.read()` writes each chunk to disk but never into the Okio `sink` buffer the `Source` contract requires, so Okio always thinks the transfer stopped short and every download fails with "Download interrupted.", regardless of what the server actually sent. Patched via `patch-package` (`mobile/patches/react-native-blob-util+0.24.10.patch`, reapplied by the `postinstall` script on every `npm install` - don't delete/ignore that patch file, and re-diff it if this dependency is ever upgraded). Screens get sensor data only through these hooks.
- `mobile/src/components/` — small presentational pieces shared across screens: `CircularGauge` (SVG ring gauge), `SectionHeader`, `RangeSelector` (segmented time-range buttons), `Chip` (filter pill), `ParameterRow` (dashboard list row), `TrendChart` (SVG line chart, fed real `/history` values), `Icon` (renders a Lucide-style path via `react-native-svg`).
- `mobile/src/constants/parameters.ts` — the 7 official parameters with display metadata (name/unit/icon), single source of truth so screens don't repeat this list; matches `backend/src/config.js` `OFFICIAL_PARAMETERS`.
- `mobile/src/utils/iaqScore.ts` — no longer the old placeholder ("% of parameters normal", which read 100 for any reporting device until `thresholds` rows existed). The Dashboard's gauge is now backed by `backend/src/services/iaqIndex.js`, a composite ISPU-style index (Indonesia's official Peraturan Menteri LHK P.14/2020 sub-index formula for PM10/PM2.5/NO2; CO2/TVOC/noise/lux breakpoints are this project's own extension onto the same 0/50/100/200/300+ scale, each cited to a real guideline — see that file's header comment) combined via a user-confirmed (2026-09-13) weighted average, not ISPU's own "worst pollutant wins" rule. `iaqScore.ts` itself now just maps the 5 ISPU categories onto this app's 4-tone status palette. Revisit the weights/non-ISPU breakpoints if the thesis needs a more rigorously justified methodology (e.g. AHP/entropy weighting) — they're a documented judgment call, not settled fact.
- `mobile/src/theme.ts` — design tokens (colors, status tone lookup) ported from `design/UF IAQ.dc.html`; screens/components should pull from here rather than repeating hex literals.
- `mobile/src/services/` — `api.ts` (REST calls, JWT token caching) and `socket.ts` (WebSocket client) per `architecture.md` section 6.2; `notifications.ts` (FCM push, wired to `backend/src/services/push.js`) is implemented for **Android only** — iOS additionally needs an Apple Developer Program membership (APNs key) and a macOS build, neither of which exist yet, so it no-ops there. Requires `mobile/android/app/google-services.json` (gitignored, copy from `google-services.json.example`) to build — see `mobile/README.md` "Push notifications". The mobile app only ever talks to `backend/`, never to MQTT/the device directly.
- `mobile/src/config/env.ts` (gitignored, copy from `env.example.ts`) — backend `API_BASE_URL` (must be the backend host's LAN IP, not `localhost`, for a physical device — unless tunneled over USB with `adb reverse`, needed on networks with AP/Client Isolation enabled), the placeholder `APP_ACCESS_KEY` (must match `backend/.env`), and `DEFAULT_DEVICE_ID` (`"room-01"`).

Fonts: `design/UF IAQ.dc.html` uses Google Fonts "Archivo" via a `<link>` tag, which only works in a browser — React Native has no CSS `@font-face` equivalent without bundling `.ttf` files as native assets and relinking. `mobile/src/theme.ts`'s `FONT_FAMILY` falls back to the platform system font; this is a known simplification, not a bug.

Android/iOS native project identifiers: both are now `com.bhiaq` (Android `applicationId`/`namespace` in `mobile/android/app/build.gradle`, package dir `mobile/android/app/src/main/java/com/bhiaq/`; iOS `PRODUCT_BUNDLE_IDENTIFIER` in `mobile/ios/UdaraApp.xcodeproj/project.pbxproj`, replacing the template default `org.reactjs.native.example.$(PRODUCT_NAME)`). The Xcode/Gradle *project* name (`UdaraApp` - `PRODUCT_NAME`, the `ios/UdaraApp` folder, `rootProject.name` in `settings.gradle`, the RN `AppRegistry`/`getMainComponentName()` name) is deliberately left unchanged - renaming that touches the JS↔native bridge registration and the Xcode project/scheme/folder structure itself, which isn't verifiable without a macOS build; revisit only if asked explicitly.

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
- `backend/src/services/mqtt.js` — subscribes to `hospital/+/sensors` on HiveMQ Cloud (TLS, cert verified) and runs the ingest pipeline per message: validate → resolve device → store reading → evaluate thresholds → update `alerts` (open/resolve, no longer pushes on its own — see below) → broadcast over WebSocket → run the composite-status prediction step (see `services/ml.js` below), which sends an FCM push (`services/push.js`) only when the composite AI label *enters* Peringatan/Bahaya (not every cycle it stays there); wrapped so an ml-service or FCM outage never breaks the core pipeline.
- `backend/src/services/db.js` — all PostgreSQL access (Supabase); other modules never query the DB directly.
- `backend/src/services/threshold.js` — pure rule-based evaluation against the `thresholds` table + fixed recommendation text (`architecture.md` 4.2a); this is unchanged and stays authoritative for alerts/recommendations — see the "rule-based/ML split" note above.
- `backend/src/services/ml.js` — pure request-building/calling logic for `ml-service/`'s BiGRU classifier (mirrors `threshold.js`'s pure-module style). `buildWindowPayload()` is the fail-safe gate: returns `null` (skip, don't call the model) unless the last `ML_PREDICTION_WINDOW_SIZE` (60) `sensor_readings` rows are all fully populated — this is what makes the currently-uninstalled CO2/lux/temperature/humidity sensors safely stall predictions rather than corrupt them, with no special-casing needed once the hardware is back.
- `backend/src/services/push.js` — FCM push notification delivery via the Firebase Admin SDK (`architecture.md` 6.3), Android only (mobile side, see above). Fails safe (logs once, skips sending) when `FIREBASE_SERVICE_ACCOUNT_BASE64` isn't set — same style as `ml.js`'s window gate. Tokens live in `device_push_tokens` (`schema.md` 3.7), managed via `routes/pushTokens.js`.
- `backend/src/services/ws.js` — native `ws` broadcast (the v1 choice recorded in `architecture.md` 4.4) to app clients connected at `/ws`; broadcasts both `sensor_reading` and `prediction` messages.
- `backend/src/middleware/auth.js` + `backend/src/routes/auth.js` — JWT gate on the REST API (rule.md 6). `APP_ACCESS_KEY` is a single shared secret standing in for real per-user login until user roles are decided (`prd.md` Open Questions) — don't build multi-role auth on top of this without the user confirming that decision.
- `backend/src/routes/rooms.js` — the REST endpoints from `architecture.md` 4.3 (`latest`, `history`, `export`, `status`) plus `prediction` (latest composite-status result; `{ available: false }`, not a 404, while the sensor set is incomplete). `export` resolves the format question from `prd.md` section 9: no `format` query param keeps the original plain-JSON daily aggregate, `format=xlsx`/`format=pdf` return an actual file built by `services/export.js`. XLSX (`write-excel-file` — picked over `exceljs` after `npm install` showed exceljs pulling in several npm-deprecated transitive packages, which `rule.md`'s "no deprecated/unmaintained dependencies" rules out) has 3 sheets — Ringkasan, Rata-rata per Jam, Data Mentah (full raw readings) — PDF (`pdfkit`) has just the first two as tables, deliberately no charts, per user decision. Both share a Status column that reuses `threshold.js`'s `evaluateThresholds()`, so it fails safe the same way alerts do. Wired up on the mobile side via `hooks/useExport.ts` + `HistoryScreen.tsx`'s download buttons, using `react-native-blob-util` to fetch the file with the auth header and hand it to the OS viewer/share sheet (`android.actionViewIntent` / `ios.previewDocument`) — see that hook's top comment for the current caveats (always exports "today", iOS untested since it needs a macOS build).
- `backend/src/routes/pushTokens.js` — `POST`/`DELETE /api/push-tokens`, registers/removes one app install's FCM token (not scoped to a room/device, see `schema.md` 3.7's note about no `users` table yet).
- `backend/sql/schema.sql` — mirrors `schema.md` table-for-table; `backend/sql/seed.sql` seeds only the v1 device/room row, deliberately not `thresholds` (final standard values are an open question, see `prd.md` section 8) — until threshold rows exist, `evaluateThresholds()` fails safe and raises no alerts.

See `backend/README.md` "Known placeholders" for what's stubbed (DB TLS cert pinning, export file format, data retention) and for push notification's current caveats (Android only, no per-user targeting yet).

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
- Only ever called by `backend/src/services/ml.js` over `http://127.0.0.1:<port>/predict` (see `backend/src/config.js` `ML_SERVICE_URL`) — on a raw VPS this stays localhost-only and needs no auth. Actual v1 hosting is shared cPanel hosting instead (see `deploy/cpanel-README.md`), where "Setup Python App" always assigns a public Application URL with no loopback-only option — there, `ML_SERVICE_SHARED_SECRET` (config.js / app.py, sent as the `X-ML-Service-Token` header) stands in for that missing network isolation. Unset on both sides for a true localhost-only deployment; must match on both sides when set.

## firmware/ (PlatformIO / ESP32)

Two parallel PlatformIO board targets build from the same `src/`/`include/`
tree (see `firmware/README.md` "Board targets" for exactly how pins/display
library are resolved per env): `esp32doit-devkit-v1` (ESP32 DevKitC V4 +
`TFT_eSPI`, default/primary — architecture.md's original component
decision) and `esp32-s3-devkitc-1` (ESP32-S3 N16R8 + `GFX Library for
Arduino`/Arduino_GFX_Library, opt-in — ported in from an Arduino IDE
bring-up sketch, `firmware/arduino_ide/UdaraS3/UdaraS3.ino`, now
decomposed into this tree; that sketch folder no longer exists). Both
target the same physical ST7796 4.0" 480x320 panel and the same card-based
"Smart Dispenser" UI theme (`firmware/src/display/dispenser_theme.h`).

```sh
cd firmware
cp include/secrets.h.example include/secrets.h   # fill in real WiFi/MQTT creds, gitignored

pio run                       # build (default env = ESP32 DevKitC V4, final ST7796 4.0" display)
pio run --target upload        # flash over USB
pio device monitor             # serial monitor, 115200 baud

pio run -e esp32-s3-devkitc-1                 # ESP32-S3 target (opt-in)
pio run -e esp32-s3-devkitc-1 --target upload

# Temporary bench-test env (2.4" ILI9341-family display) on the ESP32
# DevKitC V4 target, used while the ST7796 4.0" unit was in transit — see
# `firmware/README.md` "Hardware":
pio run -e esp32doit-devkit-v1-dev-display
```

### Architecture

- `firmware/include/config.h` — every pin assignment and timing interval as a named constant (rule.md 5); one `#if CONFIG_IDF_TARGET_ESP32S3 / #else` block covers every board-specific pin (auto-selected by which PlatformIO env is building, no manual flag) so both board targets share this one file. Check here first when wiring changes.
- `firmware/include/thresholds.h` — local, device-side normal ranges for the 7 official parameters, used only to drive color-coded values in the on-screen card UI (`firmware/src/display/`) so it keeps working when the device is offline from the broker (`architecture.md` 2.2). There is no physical LED indicator — that was the original v1 plan (10x LED, `architecture.md` 2.1) but was dropped in favor of the on-screen indicator alone; don't reintroduce LED code/wiring without the user confirming that decision reversed. This threshold table is separate from the server-side `thresholds` table in `schema.md`, which is the source of truth for history/notifications/rule-based recommendations (`architecture.md` 4.2a).
- `firmware/include/secrets.h` (gitignored, copy from `secrets.h.example`) — WiFi + HiveMQ Cloud credentials. Never hardcode these directly in `.cpp` files or commit real values.
- `firmware/include/User_Setup.h` — TFT_eSPI display pin/driver config for the ESP32 DevKitC V4 target's **official** ST7796 4.0" 480x320 display (replaces the originally planned ILI9341 2.8" — see `architecture.md` 2.1), injected via `-include` in that env only rather than editing the library's bundled copy (which `pio lib update` would overwrite). `firmware/include/User_Setup_Dev.h` is a **temporary** sibling config for bench-testing with a 2.4" ILI9341-family display while the ST7796 unit was in transit (`architecture.md` 2.2) — only used by the separate `esp32doit-devkit-v1-dev-display` PlatformIO env; delete both once the ST7796 unit is confirmed working. Neither file applies to the `esp32-s3-devkitc-1` env, which drives the same panel through Arduino_GFX_Library instead (pins read directly from `config.h` at runtime, no macro injection needed).
- `firmware/src/sensors/` — one file pair per sensor: SDS011 (PM2.5/PM10, UART1, replaces PMS5003), `mhz19c.*` (CO2, UART2, replaces SCD30 — originally sourced as Winsen MH-Z19B, the physical unit that arrived was a Huiwen MWD1006 instead, which later stopped working and was replaced 2026-09-01 with a genuine Winsen MH-Z19C; same UART protocol throughout, see `mhz19c.h` and `firmware/README.md` "Known placeholders"), SGP30 (TVOC, I2C — `sgp30SetHumidity()` feeds it SHT31's temp/humidity for compensation, called from `sensors.cpp`), MiCS-4514 (NO2, I2C — shares the main bus on the DevKitC V4 target, gets its own dedicated `Wire1` bus on the ESP32-S3 target), BH1750 (lux, I2C), MAX9814-based noise (ADC). SDS011/the CO2 module replaced the originally planned sensors due to seller pre-order lead times (`architecture.md` 2.1) — pin budget was rebudgeted accordingly in `config.h`. Each reads into the shared `SensorReadings` struct (`include/sensor_data.h`) via `sensors.h`'s `sensorsRead()`. Sensor code has no knowledge of display or network. GY-SHT31 (room temperature, I2C) is also read here — it IS published over MQTT and persisted like the 7 official parameters, but is deliberately excluded from threshold evaluation and status-label/alert triggering (see the warning comment on `SensorReadings::roomTempC`); don't wire it into those paths without also updating `prd.md` (new FR) and `schema.md` 3.4.
- `firmware/src/network/` — `wifi_conn.*` and `mqtt_pub.*`. Both expose non-blocking `*Maintain()` functions called every `loop()` iteration; actual reconnect attempts are internally rate-limited by the intervals in `config.h`. `mqttPublishReadings()` serializes `SensorReadings` (7 official parameters + `temperature`) to the JSON shape defined in `architecture.md` 2.3 and publishes to `hospital/{DEVICE_ID}/sensors`.
- `firmware/src/display/` — `display.h` (shared interface, both board targets) + `dispenser_theme.h` (shared colors/layout constants for the card-based "Smart Dispenser" UI) + two backend implementations, only one ever compiled per env (`platformio.ini`'s per-env `build_src_filter`): `display_tftespi.cpp` (ESP32 DevKitC V4, `TFT_eSPI`) and `display_gfx.cpp` (ESP32-S3, Arduino_GFX_Library). Both render per-parameter color-coded value cards evaluated against `thresholds.h` — the device's only out-of-range indicator, there is no LED — kept as a separate concern from sensor reading (rule.md 3).
- `firmware/src/main.cpp` — `setup()`/`loop()` orchestration only, board-agnostic; no sensor/display/network logic lives here directly.

See `firmware/README.md` "Known placeholders" for values that are stand-ins (NO2 conversion factor, noise calibration, on-screen status-label thresholds, TLS cert pinning) and must be revisited before treating firmware output as trustworthy.
