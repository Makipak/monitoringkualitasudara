# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is a freshly scaffolded React Native app (**Udara**) — no IoT connectivity is implemented yet. The user will describe the actual IoT hardware/protocol requirements (BLE device, MQTT broker, WiFi provisioning, etc.) in a follow-up; `src/services/` is an intentionally empty planning stub until then. Don't assume a specific protocol or backend is wired up — check `src/services/README.md` for the current plan before implementing.

## Commands

```sh
npm install                 # install JS deps (run this first — node_modules is not committed)

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
cd ios && bundle install && bundle exec pod install && cd ..
```

## Architecture

Bare React Native CLI project (not Expo) with TypeScript and the New Architecture template (`0.87.0`), so native module changes go directly through `android/` (Kotlin) and `ios/` (Swift) — there is no Expo config-plugin layer.

- `index.js` — entry point. `react-native-gesture-handler` must stay the very first import here (required transitively by React Navigation's native-stack); don't reorder it.
- `App.tsx` — root component. Wraps everything in `SafeAreaProvider` and renders `RootNavigator`. Keep this file thin; screen/navigation logic belongs in `src/`.
- `src/navigation/RootNavigator.tsx` — single source of truth for routes. `RootStackParamList` defines every screen's params; new screens must be added to this type and to the `Stack.Navigator` here so `navigation.navigate(...)` stays type-checked. Uses `@react-navigation/native-stack`.
- `src/screens/` — one file per screen. Screens import their prop types via `RootStackScreenProps<'ScreenName'>` from `RootNavigator.tsx` rather than typing props by hand.
- `src/services/` — planned home for device-communication logic, kept separate from UI. See `src/services/README.md` for the current plan (BLE via `react-native-ble-plx`, MQTT via `mqtt`/`react-native-mqtt`, WiFi provisioning via `react-native-wifi-reborn`) — none of this is implemented yet.

Android/iOS native project identifiers: Android package `com.udaraapp`; iOS bundle id is still the template default `org.reactjs.native.example.$(PRODUCT_NAME)` in `ios/UdaraApp.xcodeproj/project.pbxproj` and should be updated before any real device testing or store submission.

Config files (`babel.config.js`, `metro.config.js`, `jest.config.js`, `tsconfig.json`, `.eslintrc.js`) are all unmodified `@react-native/*` presets — no custom aliasing, transforms, or lint rules have been added.
