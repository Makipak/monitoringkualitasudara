# Falhora (mobile)

React Native (bare CLI, TypeScript) app for the Udara hospital air quality
monitoring system - see `../architecture.md` section 6 for the full
design. Display name is "Falhora" - Faletehan Hospital Indoor Air Quality
(see `../CLAUDE.md` Project status); Android/iOS bundle identifier is
`com.bhiaq`. The underlying RN project/module name (`UdaraApp` - npm
`name`, Xcode `PRODUCT_NAME`, `ios/UdaraApp` folder) is unchanged.

- Navigation: React Navigation, bottom tabs (Beranda/Prediksi/Riwayat/Tentang)
  with a nested native-stack inside Beranda for the parameter detail screen -
  see `src/navigation/RootNavigator.tsx`.
- Screens: `src/screens/` - one file per screen, presentational only; data
  fetching lives in `src/hooks/` (rule.md section 7).
- Backend calls: `src/services/api.ts` (REST + JWT) and `socket.ts`
  (WebSocket) - the app only ever talks to `../backend/`, never directly
  to MQTT/the device.
- Local config: `src/config/env.ts` (gitignored, copy from `env.example.ts`).
- Visual design ported from a Claude Design prototype (`../design/UF IAQ.dc.html`) -
  see that file's structure for the reference layout/copy this UI follows.
  The design's "Prediksi" (AI) tab mockup assumed per-parameter forecasts +
  a future trend chart; the actual trained model (`../ml-service/`, a BiGRU
  classifier) only outputs a composite status label + per-class
  probabilities, so `src/screens/PredictionScreen.tsx` was redesigned to
  show real model output instead of following that mockup 1:1 - see the
  notice at the top of that file.

Setup pertama kali:

```sh
npm install
cp src/config/env.example.ts src/config/env.ts   # fill in backend URL + access key, gitignored
# iOS saja:
cd ios && bundle install && bundle exec pod install && cd ..
```

**OS untuk development:**

- **Android**: bisa dikembangkan di Linux, macOS, maupun Windows. Pastikan Android SDK/Android Studio & Java sudah terpasang (lihat [set up your environment](https://reactnative.dev/docs/set-up-your-environment) untuk distro/OS masing-masing). Di Linux, device fisik lewat USB umumnya butuh [udev rules](https://developer.android.com/studio/run/device#setting-up) supaya terbaca oleh `adb`.
- **iOS**: hanya bisa dibangun/dijalankan di **macOS** (butuh Xcode + CocoaPods) — tidak bisa dari Linux atau Windows.

## Push notifications

FCM push notification (`src/services/notifications.ts`, architecture.md
6.3) - **Android only** for now; iOS additionally needs an Apple Developer
Program membership (for an APNs key) and a macOS build, neither of which
exist yet.

```sh
cp android/app/google-services.json.example android/app/google-services.json
# replace with the real file: Firebase Console -> Project Settings ->
# General -> Your apps -> Android app (package com.bhiaq)
```

`google-services.json` is gitignored - never commit the real file. Without
it, `pio`-style native Android builds will fail at the
`com.google.gms.google-services` Gradle plugin step (`android/app/build.gradle`)
with a "File google-services.json is missing" error - copy the example
file above (with a real Firebase project's values) before running
`npm run android` for the first time.

On first launch the app requests the `POST_NOTIFICATIONS` runtime
permission (Android 13+) and registers its FCM token with the backend via
`POST /api/push-tokens` - see `backend/README.md`'s "Known placeholders"
for the current server-side behavior (works once
`FIREBASE_SERVICE_ACCOUNT_BASE64` is set there, fails safe/skips
otherwise).

## Export laporan

`HistoryScreen.tsx`'s "Unduh Excel"/"Unduh PDF" buttons (`src/hooks/useExport.ts`)
download today's report from `GET /api/rooms/:deviceId/export?format=xlsx|pdf`
(`backend/README.md`) and hand it to the OS to open, via
`react-native-blob-util` - a native module, so it needs the `pod install`
step above on iOS (already covered by the "Setup pertama kali" commands,
just re-run it after pulling this dependency for the first time; Android
needs no extra setup). iOS is untested from development so far - no
macOS build available yet, same caveat as push notifications above.

`react-native-blob-util@0.24.10`'s Android download path has an upstream
bug that makes every download fail with a generic "Download interrupted."
error regardless of what the server sent - its progress-reporting
`Source.read()` writes each chunk to disk but never into the Okio `sink`
buffer the `Source` contract requires, so Okio always thinks the transfer
stopped short. Patched via `patch-package` - `patches/react-native-blob-util+0.24.10.patch`,
reapplied automatically by the `postinstall` script on every `npm install`.
Don't delete `patches/` or add it to `.gitignore`; if this dependency is
ever upgraded, re-diff the patch (`npx patch-package react-native-blob-util`
after re-applying the same one-line fix, or drop the patch if upstream has
fixed it by then).
There is no date picker - it always exports the current calendar day.

---

This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
