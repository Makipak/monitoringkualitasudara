# Architecture - Hospital Air Quality Monitoring System

## 1. Overview

Sistem terdiri dari 4 layer utama: **Device (ESP32)**, **Message Broker (HiveMQ Cloud)**, **Backend (Node.js + PostgreSQL via Supabase)**, dan **Mobile App (React Native)**. Semua komunikasi antar layer melalui internet, bukan LAN lokal.

```
┌─────────────────┐        ┌──────────────────┐        ┌───────────────────────┐        ┌──────────────────┐
│   Device Layer   │        │   Broker Layer    │        │     Backend Layer      │        │   App Layer      │
│                  │        │                    │        │                        │        │                  │
│  ESP32 WROOM-32D │ MQTT   │  HiveMQ Cloud      │ MQTT   │  Node.js (Express/     │ REST/  │  React Native    │
│  + 6 sensor      │ ─────> │  (managed broker,  │ ─────> │  Fastify)              │ WS     │  App             │
│  + TFT + LED     │  TLS   │  TLS 8883)         │        │  + PostgreSQL          │ ─────> │                  │
│                  │        │                    │        │  (Supabase)            │        │                  │
└─────────────────┘        └──────────────────┘        └───────────────────────┘        └──────────────────┘
```

**Catatan:** TimescaleDB awalnya dipertimbangkan untuk data time-series, tapi tidak dipakai karena (1) volume data proyek ini kecil — 1 device, interval puluhan detik, jauh di bawah skala yang butuh hypertable — dan (2) extension `timescaledb` sudah deprecated di project Supabase yang pakai Postgres 17. PostgreSQL biasa dengan index yang tepat di kolom waktu sudah cukup untuk kebutuhan ini.

## 2. Device Layer

### 2.1 Komponen
- MCU: ESP32 DevKitC V4 WROOM-32D
- Sensor: PMS5003 (UART), SCD30 (I2C), GY-SGP30 (I2C), MiCS-4514 (I2C), BH1750 (I2C), MAX9814 (ADC)
- Display: ILI9341 2.8" TFT SPI (TFT_eSPI)
- Indikator: 10x LED merah 5mm

### 2.2 Tanggung Jawab
- Membaca seluruh sensor pada interval tetap.
- Menampilkan nilai di TFT.
- Mengevaluasi threshold lokal (rule sederhana) untuk menyalakan LED merah secara instan — ini berjalan independen dari koneksi internet, supaya indikator visual tetap berfungsi walau device sedang offline dari broker.
- Publish data ke topic MQTT saat koneksi tersedia.

### 2.3 Format Payload (usulan awal, detail final di schema.md)

```json
{
  "device_id": "room-01",
  "timestamp": "2026-08-17T10:00:00Z",
  "pm25": 12.4,
  "pm10": 18.7,
  "no2": 0.02,
  "co2": 620,
  "tvoc": 150,
  "lux": 300,
  "noise_db": 42.5
}
```

### 2.4 Contoh Publish (Arduino/PlatformIO)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* mqtt_server = "xxxxxx.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;

WiFiClientSecure espClient;
PubSubClient client(espClient);

void publishSensorData(float pm25, float pm10, float no2, float co2, float tvoc, float lux, float noiseDb) {
  StaticJsonDocument<256> doc;
  doc["device_id"] = "room-01";
  doc["pm25"] = pm25;
  doc["pm10"] = pm10;
  doc["no2"] = no2;
  doc["co2"] = co2;
  doc["tvoc"] = tvoc;
  doc["lux"] = lux;
  doc["noise_db"] = noiseDb;

  char buffer[256];
  serializeJson(doc, buffer);
  client.publish("hospital/room-01/sensors", buffer);
}
```

**Catatan:** timestamp sengaja tidak di-generate di device (ESP32 tanpa RTC module rawan salah waktu), sebaiknya di-assign oleh backend saat data diterima.

## 3. Broker Layer (HiveMQ Cloud)

- Managed MQTT broker, TLS wajib (port 8883).
- Topic naming convention: `hospital/{device_id}/sensors`.
- Autentikasi: username/password per device (disimpan di firmware, idealnya via `Preferences`/NVS ESP32, bukan hardcode langsung di source jika memungkinkan).
- Trade-off yang perlu dicatat: sistem bergantung pada uptime HiveMQ Cloud. Untuk skala skripsi (1 device) risiko ini kecil dan dapat diterima; jika di masa depan sistem discale ke banyak device di produksi RS sungguhan, evaluasi ulang broker self-hosted atau paid tier dengan SLA.

## 4. Backend Layer

### 4.1 Tanggung Jawab
- Subscribe ke topic MQTT dari HiveMQ Cloud.
- Assign timestamp server-side saat data diterima.
- Simpan data ke PostgreSQL (Supabase).
- Evaluasi threshold (server-side, sebagai sumber kebenaran untuk histori/notifikasi — terpisah dari threshold instan di device).
- Trigger push notification saat ada parameter out-of-range.
- Expose REST API (data terkini, histori, export harian).
- Broadcast update real-time ke app yang sedang terbuka (WebSocket).

### 4.2 Contoh Subscribe (Node.js)

```javascript
import mqtt from "mqtt";
import { insertSensorReading } from "./db.js";
import { evaluateThresholds } from "./threshold.js";
import { broadcastToClients } from "./ws.js";

const client = mqtt.connect("mqtts://xxxxxx.s1.eu.hivemq.cloud:8883", {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

client.on("connect", () => {
  client.subscribe("hospital/+/sensors");
});

client.on("message", async (topic, payload) => {
  const data = JSON.parse(payload.toString());
  const reading = { ...data, received_at: new Date().toISOString() };

  await insertSensorReading(reading);

  const alerts = evaluateThresholds(reading);
  if (alerts.length > 0) {
    // trigger push notification, lihat bagian 4.3
  }

  broadcastToClients(reading, alerts);
});
```

### 4.3 REST API (usulan endpoint awal)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/rooms/:deviceId/latest` | Nilai terkini seluruh parameter |
| GET | `/api/rooms/:deviceId/history?from=&to=` | Data historis dengan rentang waktu |
| GET | `/api/rooms/:deviceId/export?date=` | Export data harian |
| GET | `/api/rooms/:deviceId/status` | Status normal/tidak per parameter |

Detail skema request/response akan dituliskan lebih lengkap saat implementasi API, bukan bagian dari dokumen arsitektur ini.

### 4.4 Realtime ke App

- WebSocket (`socket.io` atau native `ws`) digunakan agar app yang sedang dibuka mendapat update tanpa polling.
- Trade-off: `socket.io` lebih mudah untuk reconnect handling & room-based broadcast (berguna kalau nanti multi-device), tapi overhead sedikit lebih besar dibanding `ws` native. Untuk v1 (1 device), `ws` native sudah cukup; `socket.io` lebih future-proof kalau rencana multi-room direalisasikan.

## 5. Database Layer (PostgreSQL via Supabase)

- Data sensor disimpan di tabel PostgreSQL biasa (bukan hypertable), dengan index pada kolom waktu (`time`) dan composite index `(device_id, time DESC)` untuk menjaga performa query histori/export tetap cepat pada skala data proyek ini (1 device, ~1.500-3.000 baris/hari).
- Supabase dipilih karena tidak perlu maintain server database sendiri (managed, ada free tier). Region yang dipilih sebaiknya yang paling dekat (Singapore) untuk menekan latency.
- Skema tabel detail dituliskan di `schema.md`.
- Retensi data: belum difinalkan — perlu didiskusikan apakah data disimpan permanen atau ada kebijakan retensi (misal hapus/arsip data lama untuk hemat storage).
- Perlu diperhatikan: Supabase free tier melakukan auto-pause project jika tidak ada aktivitas ~1 minggu, menyebabkan request pertama setelah pause delay beberapa detik. Perlu diantisipasi menjelang demo/sidang (misal ping endpoint sebelum demo).

## 6. Mobile App Layer (React Native)

### 6.1 Tanggung Jawab
- Menampilkan dashboard real-time (via WebSocket) dan histori (via REST).
- Menampilkan status per parameter (normal/tidak normal) berdasarkan hasil evaluasi backend.
- Menerima push notification.
- Memicu export data harian melalui backend.

### 6.2 Struktur Folder (usulan, menyesuaikan project RN yang sudah ada)

```
src/
  screens/
    DashboardScreen.tsx
    HistoryScreen.tsx
    ExportScreen.tsx
  components/
    ParameterCard.tsx
    StatusBadge.tsx
  services/
    api.ts
    socket.ts
    notifications.ts
  hooks/
    useSensorData.ts
    useAlerts.ts
```

### 6.3 Push Notification

- Kandidat: Firebase Cloud Messaging (FCM) — umum dipakai di RN, gratis, terintegrasi baik dengan backend Node.js via Firebase Admin SDK.
- Alur: backend deteksi out-of-range → backend kirim ke FCM → FCM kirim ke device app.

## 7. Security

- MQTT: TLS wajib (port 8883), autentikasi username/password per device.
- REST API: autentikasi JWT untuk request dari mobile app.
- Environment variable untuk seluruh credential (MQTT, DB, JWT secret, FCM key) — tidak boleh hardcode atau ter-commit ke repository (lihat `rule.md`).
- Validasi payload masuk dari MQTT di sisi backend (jangan langsung percaya data device tanpa validasi struktur/range dasar), untuk menghindari data korup masuk ke DB akibat bug firmware.

## 8. Deployment (usulan awal, sederhana untuk skala skripsi)

- Backend dijalankan di 1 VPS kecil (harus nyala 24/7 untuk subscribe MQTT terus-menerus).
- Database menggunakan Supabase (managed PostgreSQL, terpisah dari VPS) untuk mengurangi beban maintenance server database.
- HiveMQ Cloud sebagai broker terpisah (managed, di luar VPS).
- Mobile app dijalankan via Expo/React Native CLI, distribusi APK untuk demo sidang (belum perlu ke Play Store).

## 9. Item yang Masih Terbuka

- Desain sistem rekomendasi ML (letak inference, trigger, integrasi ke flow di atas) — menyusul setelah didiskusikan dengan tim.
- Kebijakan retensi data historis.
- Role/permission user di app (memengaruhi apakah perlu auth multi-role di backend).
- Pemilihan `socket.io` vs `ws` final saat implementasi.
