# services

Tempat logic komunikasi ke device IoT, dipisah dari UI (screens/).

Rencana modul (belum diimplementasi — tambah sesuai kebutuhan):

- `ble.ts` — scan & connect BLE pakai [`react-native-ble-plx`](https://github.com/dotintent/react-native-ble-plx).
  Perlu permission `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` (Android 12+) dan `NSBluetoothAlwaysUsageDescription` (iOS Info.plist).
- `mqtt.ts` — publish/subscribe ke broker (mis. HiveMQ/Mosquitto) pakai [`mqtt`](https://github.com/mqttjs/MQTT.js) via WebSocket, atau `react-native-mqtt` untuk TCP native socket (lebih hemat baterai untuk koneksi persisten).
- `wifiProvisioning.ts` — kalau device baru perlu di-setup WiFi-nya lewat AP mode / SoftAP (mis. ESP32 di provisioning mode), pakai `react-native-wifi-reborn` untuk baca SSID & switch network.

Trade-off singkat:
- BLE: latency rendah, cocok untuk pairing/setup awal & command jarak dekat. Butuh app di foreground/background service utk scan lama.
- MQTT: cocok untuk telemetry & control jarak jauh via internet, tapi butuh broker + device online.
