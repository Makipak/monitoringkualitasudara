# Architecture - Hospital Air Quality Monitoring System

## 1. Overview

Sistem terdiri dari 4 layer utama: **Device (ESP32)**, **Message Broker (HiveMQ Cloud)**, **Backend (Node.js + PostgreSQL via Supabase)**, dan **Mobile App (React Native)**. Semua komunikasi antar layer melalui internet, bukan LAN lokal.

```
┌─────────────────┐        ┌──────────────────┐        ┌───────────────────────┐        ┌──────────────────┐
│   Device Layer   │        │   Broker Layer    │        │     Backend Layer      │        │   App Layer      │
│                  │        │                    │        │                        │        │                  │
│  ESP32 WROOM-32D │ MQTT   │  HiveMQ Cloud      │ MQTT   │  Node.js (Express/     │ REST/  │  React Native    │
│  + 6 sensor      │ ─────> │  (managed broker,  │ ─────> │  Fastify)              │ WS     │  App             │
│  + TFT 4.0"      │  TLS   │  TLS 8883)         │        │  + PostgreSQL          │ ─────> │                  │
│  + LED           │        │                    │        │  (Supabase)            │        │                  │
└─────────────────┘        └──────────────────┘        └───────────────────────┘        └──────────────────┘
```

**Catatan:** TimescaleDB awalnya dipertimbangkan untuk data time-series, tapi tidak dipakai karena (1) volume data proyek ini kecil — 1 device, interval puluhan detik, jauh di bawah skala yang butuh hypertable — dan (2) extension `timescaledb` sudah deprecated di project Supabase yang pakai Postgres 17. PostgreSQL biasa dengan index yang tepat di kolom waktu sudah cukup untuk kebutuhan ini.

## 2. Device Layer

### 2.1 Komponen
- MCU: ESP32 DevKitC V4 WROOM-32D
- Sensor: SDS011 (UART1, PM2.5/PM10), MH-Z19B (UART2, CO2), GY-SGP30 (I2C), MiCS-4514 (I2C), BH1750 (I2C), MAX9814 (ADC), GY-SHT31 (I2C, suhu ruangan)
- Display: **TFT SPI 4.0" driver ST7796, 480x320px** (`TFT_eSPI`) — menggantikan rencana Nextion (UART + software editor terpisah) maupun rencana awal ILI9341 2.8" (dianggap terlalu kecil oleh dosen pembimbing).
- Indikator: 10x LED merah 5mm

### 2.2 Tanggung Jawab
- Membaca seluruh sensor pada interval tetap.
- Menampilkan nilai di TFT langsung lewat kode (fungsi gambar teks/angka per parameter menggunakan `TFT_eSPI`, tidak ada software desain UI terpisah).
- Mengevaluasi threshold lokal (rule sederhana) untuk menyalakan LED merah secara instan — ini berjalan independen dari koneksi internet, supaya indikator visual tetap berfungsi walau device sedang offline dari broker.
- Publish data ke topic MQTT saat koneksi tersedia.

**Catatan pemilihan display (ST7796 4.0", bukan Nextion):**
- **Alasan:** proyek ini memprioritaskan kesederhanaan alur kerja (satu bahasa/tool, langsung coding, tanpa software editor tambahan seperti Nextion Editor) dibanding kemudahan desain visual drag-and-drop.
- **Interface:** SPI, sama seperti rencana ILI9341 awal — pin dialokasikan sama seperti sebelumnya (MOSI, MISO, SCK, CS, DC, RST di jalur VSPI GPIO 15/4/2/23/18/19).
- **Library:** tetap `TFT_eSPI`, hanya konfigurasi driver di `User_Setup.h` yang diganti dari `ILI9341_DRIVER` menjadi `ST7796_DRIVER` — tidak perlu belajar library/tool baru.
- **Ukuran & resolusi:** 4.0" (480x320px, perlu dikonfirmasi ulang ke seller karena ada ketidaksesuaian info produk antara 480x320 dan 320x240 di listing pembelian), signifikan lebih besar dari ILI9341 2.8" sebelumnya, dan jauh lebih murah dibanding opsi Nextion (~Rp360.000 vs jutaan rupiah untuk Nextion) — perlu diupdate manual di `projek.xlsx` (BOM).
- Opsi lain yang sempat dipertimbangkan dan tidak dipilih: Nextion Basic/Enhanced/Intelligent Series (perlu software Nextion Editor terpisah dan MCU display sendiri), ESP32 LVGL Smart Display all-in-one (kompleksitas GPIO/processing lebih tinggi, dokumentasi generic/clone kurang jelas), TJC (varian pasar China dari Nextion, dokumentasi kurang lengkap untuk pasar global), ILI9488 3.5" (alternatif SPI TFT lain di kelas ukuran serupa).
- **Catatan development sementara:** unit TFT 4.0" ST7796 masih dalam pengiriman. Selama menunggu, development firmware dilakukan sementara menggunakan TFT SPI 2.4" (kemungkinan chip ILI9341, satu keluarga dengan ST7796) yang sudah tersedia — interface, pin, dan library (`TFT_eSPI`) sama persis, hanya beda konfigurasi driver (`ILI9341_DRIVER`) dan resolusi (320x240 vs 480x320 pada unit final). Ini bukan perubahan keputusan komponen; ST7796 4.0" tetap komponen resmi untuk perangkat final. Setelah unit 4.0" tiba, konfigurasi driver di `User_Setup.h` diganti ke `ST7796_DRIVER` dan koordinat/skala elemen tampilan disesuaikan dengan resolusi baru.

**Catatan suhu ruangan:** menggunakan sensor dedicated **GY-SHT31** (I2C, default address `0x44`, digabung ke bus I2C yang sama dengan SGP30/MiCS-4514/BH1750 tanpa konflik address). Nilai suhu dikirim ke MQTT, disimpan ke database, dan ditampilkan di layar TFT maupun mobile app — **namun statusnya tetap sebagai info pendukung, bukan parameter resmi ber-alert**: tidak dievaluasi terhadap threshold, tidak memicu LED/notifikasi, dan tidak dihitung dalam status normal/tidak normal ruangan. Jika ke depan suhu perlu naik status jadi parameter dengan alert penuh, update `prd.md` (tambah FR) dan `thresholds`/evaluasi alert di `schema.md`.

**Catatan penggantian sensor CO2 (MH-Z19B, bukan SCD30):**
- **Alasan:** sama seperti SDS011 — SCD30 di seller yang tersedia mengalami waktu pre-order (PO) yang lama, tidak sesuai tenggat waktu proyek. MH-Z19B dipilih karena ready stock dan umum ditemukan di marketplace lokal.
- **Interface:** berubah dari I2C (SCD30) menjadi **UART** (MH-Z19B). Dialokasikan ke **UART2** ESP32 — sebelumnya dialokasikan untuk Nextion (sudah tidak dipakai setelah keputusan pindah ke TFT SPI), sehingga tidak ada konflik alokasi UART. UART1 tetap untuk SDS011, UART0 tetap untuk programming/debug.
- **Konsekuensi kehilangan output suhu/RH bawaan SCD30:** tidak berdampak, karena suhu ruangan sudah ditangani terpisah oleh GY-SHT31 (lihat catatan di atas), dan RH (kelembapan) belum menjadi parameter resmi di `prd.md`/`schema.md` — jika ke depan RH dibutuhkan sebagai parameter resmi, perlu sensor humidity terpisah atau memanfaatkan output RH dari GY-SHT31 yang juga menyediakan itu.
- **Output:** CO2 dalam ppm, range umum 0-5000 ppm — sesuai kebutuhan monitoring ruangan.
- **Library:** kandidat `MHZ19` (Arduino), cek status maintenance sesuai `rule.md` sebelum dipakai.
- **Biaya:** perlu diupdate manual di `projek.xlsx` (BOM), termasuk penghapusan SCD30 dari daftar.

**Catatan penggantian sensor PM2.5/PM10 (SDS011, bukan PMS5003):**
- **Alasan:** PMS5003 dan SCD30 di seller yang tersedia mengalami waktu pre-order (PO) yang lama, tidak sesuai dengan tenggat waktu proyek. SDS011 dipilih sebagai pengganti PM2.5/PM10 karena tersedia ready stock.
- **Interface:** tetap UART, tidak mengubah alokasi pin (tetap UART1 ESP32, sama seperti rencana PMS5003 sebelumnya).
- **Output:** sama seperti PMS5003 — PM2.5 dan PM10 (µg/m3), measuring range 0.0-999.9 µg/m3.
- **Perbedaan teknis dari PMS5003:** format paket data UART berbeda dari PMS5003, memerlukan library parsing khusus (kandidat: `SdsDustSensor`, cek status maintenance sesuai `rule.md` sebelum dipakai). SDS011 memiliki kipas internal dengan estimasi umur laser diode ~8.000 jam operasi kontinu — perlu dicatat sebagai keterbatasan alat jika relevan di laporan.
- **Biaya:** lebih mahal dari PMS5003 (~Rp668.000) — perlu diupdate manual di `projek.xlsx` (BOM).

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
  "noise_db": 42.5,
  "temperature": 25.3
}
```

**Catatan:** `temperature` dikirim dan disimpan seperti parameter lain, tetapi tidak masuk evaluasi threshold/alert (lihat catatan suhu ruangan di bagian 2.2).

### 2.4 Contoh Publish (Arduino/PlatformIO)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* mqtt_server = "xxxxxx.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;

WiFiClientSecure espClient;
PubSubClient client(espClient);

void publishSensorData(float pm25, float pm10, float no2, float co2, float tvoc, float lux, float noiseDb, float temperature) {
  StaticJsonDocument<256> doc;
  doc["device_id"] = "room-01";
  doc["pm25"] = pm25;
  doc["pm10"] = pm10;
  doc["no2"] = no2;
  doc["co2"] = co2;
  doc["tvoc"] = tvoc;
  doc["lux"] = lux;
  doc["noise_db"] = noiseDb;
  doc["temperature"] = temperature;

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
- Evaluasi threshold (server-side, sebagai sumber kebenaran untuk histori/notifikasi — terpisah dari threshold instan di device). **Hanya diterapkan pada 7 parameter resmi** (pm25, pm10, no2, co2, tvoc, lux, noise_db); `temperature` disimpan dan ditampilkan tapi dikecualikan dari evaluasi ini.
- Menghasilkan rekomendasi tindakan sederhana berbasis **rule-based** (bukan Machine Learning) saat ada parameter out-of-range — lihat bagian 4.2a. Ini solusi sementara sampai sistem rekomendasi ML (lihat `prd.md` - Open Questions) siap didiskusikan dan diimplementasikan bersama tim.
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

### 4.2a Rule-Based Recommendation (interim, pengganti ML sementara)

Karena sistem rekomendasi berbasis ML belum siap (masih tahap diskusi tim, lihat `prd.md` bagian Open Questions), evaluasi dan rekomendasi memakai **rule-based sederhana**: bandingkan nilai tiap parameter terhadap `min_value`/`max_value` di tabel `thresholds`, lalu hasilkan teks rekomendasi tetap per parameter/arah penyimpangan (tinggi/rendah).

Implementasi lengkap ada di `threshold.js` (fungsi `evaluateThresholds`). Fungsi ini dipanggil di `client.on("message", ...)` seperti pada contoh subscribe di atas.

Karakteristik pendekatan ini:
- **Threshold diambil dari database** (tabel `thresholds`), bukan hardcode di kode — supaya bisa diubah begitu standar baku mutu final (Kemenkes/WHO/ASHRAE) ditentukan, tanpa redeploy.
- **Teks rekomendasi bersifat generik per parameter**, bukan personalisasi berbasis pola/tren historis seperti yang direncanakan untuk sistem ML nantinya.
- **Bisa menghasilkan lebih dari satu alert sekaligus** jika beberapa parameter menyimpang bersamaan (misal PM2.5 tinggi dan CO2 tinggi di waktu yang sama) — masing-masing dengan rekomendasi terpisah.
- Struktur `alerts` di `schema.md` sudah kompatibel dengan pendekatan ini (kolom `parameter`, `value`, `threshold_id`), sehingga tidak perlu perubahan skema.
- **Jika nanti sistem ML sudah siap**, rule-based ini bisa tetap dipertahankan sebagai *fallback* cepat (misal saat model ML gagal/timeout) atau digantikan sepenuhnya — keputusan ini menyusul setelah desain ML difinalkan bersama tim.



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

### 4.5 Struktur Folder Backend (usulan)

Backend belum di-scaffold saat dokumen ini ditulis. Struktur berikut jadi acuan implementasi (oleh siapapun/tools yang mengerjakan, termasuk Claude Cowork), mengikuti prinsip *single responsibility* di `rule.md`:

```
backend/
  src/
    services/
      threshold.js       # rule-based evaluation + rekomendasi (lihat 4.2a)
      mqtt.js             # subscribe HiveMQ, terima & parse payload sensor
      db.js               # koneksi & query PostgreSQL (Supabase)
      ws.js                # broadcast realtime ke mobile app
    routes/
      rooms.js            # REST API endpoint (lihat 4.3)
    index.js              # entry point, wiring semua service
  package.json
  .env                    # kredensial MQTT, DB, JWT secret (tidak di-commit, lihat rule.md)
```

### 4.6 Struktur Folder Proyek Keseluruhan (usulan)

```
D:\projek\udara\
  prd.md
  rule.md
  architecture.md
  schema.md
  backend\          # lihat 4.5
  firmware\          # project PlatformIO (ESP32)
  mobile-app\        # project React Native (lihat 6.2)
```

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

- Desain sistem rekomendasi ML (letak inference, trigger, integrasi ke flow di atas) — menyusul setelah didiskusikan dengan tim. Rule-based (`threshold.js`, bagian 4.2a) dipakai sebagai solusi sementara.
- Kebijakan retensi data historis.
- Role/permission user di app (memengaruhi apakah perlu auth multi-role di backend).
- Pemilihan `socket.io` vs `ws` final saat implementasi.
- **Implementasi:** backend (struktur di 4.5), firmware ESP32, dan mobile app React Native belum di-scaffold — dokumen ini (`prd.md`, `rule.md`, `architecture.md`, `schema.md`) jadi acuan utama untuk implementasi tahap berikutnya, termasuk jika dikerjakan lewat Claude Cowork.
