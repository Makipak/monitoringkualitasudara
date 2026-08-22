# Schema - Hospital Air Quality Monitoring System

## 1. Database

**PostgreSQL** (hosted di Supabase), tanpa extension TimescaleDB. Data pembacaan sensor disimpan di tabel biasa dengan index pada kolom waktu agar query rentang waktu (histori, export harian) tetap cepat.

TimescaleDB awalnya dipertimbangkan, tapi tidak dipakai karena: volume data proyek ini kecil (1 device, interval puluhan detik — jauh di bawah skala yang butuh hypertable), dan extension `timescaledb` sudah deprecated di project Supabase dengan Postgres 17. PostgreSQL biasa dengan index yang tepat sudah cukup untuk kebutuhan ini.

Skema dirancang sederhana untuk v1 (1 device/1 ruangan), tapi struktur tabel `rooms`/`devices` tetap dipisah dari awal supaya tidak perlu migrasi besar kalau nanti multi-device direalisasikan.

## 2. Entity Relationship (ringkas)

```
rooms (1) ──< devices (1) ──< sensor_readings
                    │
                    └──< alerts
                    │
                    └──< device_push_tokens

thresholds (referensi standar per parameter, tidak terikat 1 device tertentu)
```

## 3. Tabel

### 3.1 `rooms`

Menyimpan data ruangan tempat device dipasang.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID (PK) | |
| name | TEXT | Nama ruangan, misal "Ruang Perawatan A" |
| location | TEXT | Lokasi/lantai, opsional |
| created_at | TIMESTAMPTZ | default `now()` |

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 `devices`

Menyimpan data perangkat IoT. `device_id` adalah identifier yang dipakai di topic MQTT (misal `room-01`), dipisah dari `id` (UUID internal) agar identifier MQTT tetap human-readable.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID (PK) | |
| device_id | TEXT (UNIQUE) | Identifier dipakai di topic MQTT, misal `room-01` |
| room_id | UUID (FK -> rooms.id) | |
| status | TEXT | `online` / `offline`, diupdate backend berdasarkan aktivitas terakhir |
| last_seen_at | TIMESTAMPTZ | Waktu data terakhir diterima |
| created_at | TIMESTAMPTZ | default `now()` |

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  room_id UUID NOT NULL REFERENCES rooms(id),
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 `sensor_readings`

Tabel utama, menyimpan setiap pembacaan sensor. Volume data paling besar ada di sini, karena itu diberi index khusus pada kolom waktu untuk menjaga performa query.

| Kolom | Tipe | Keterangan |
|---|---|---|
| time | TIMESTAMPTZ | Waktu diterima backend (bukan waktu device, lihat catatan di `architecture.md`) |
| device_id | UUID (FK -> devices.id) | |
| pm25 | DOUBLE PRECISION | µg/m3 |
| pm10 | DOUBLE PRECISION | µg/m3 |
| no2 | DOUBLE PRECISION | ppm |
| co2 | DOUBLE PRECISION | ppm |
| tvoc | DOUBLE PRECISION | ppb |
| lux | DOUBLE PRECISION | lux |
| noise_db | DOUBLE PRECISION | dB |
| temperature | DOUBLE PRECISION | °C — disimpan dan ditampilkan (OLED/app), **tidak termasuk 7 parameter resmi**, tidak dievaluasi terhadap `thresholds`/`alerts` |

```sql
CREATE TABLE sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  device_id UUID NOT NULL REFERENCES devices(id),
  pm25 DOUBLE PRECISION,
  pm10 DOUBLE PRECISION,
  no2 DOUBLE PRECISION,
  co2 DOUBLE PRECISION,
  tvoc DOUBLE PRECISION,
  lux DOUBLE PRECISION,
  noise_db DOUBLE PRECISION,
  temperature DOUBLE PRECISION
);

-- Index utama untuk query histori per device, terurut waktu terbaru
CREATE INDEX idx_sensor_readings_device_time
  ON sensor_readings (device_id, time DESC);

-- Index tambahan untuk query lintas device berdasarkan rentang waktu (misal export harian)
CREATE INDEX idx_sensor_readings_time
  ON sensor_readings (time DESC);
```

Satuan di atas (ppm/ppb/µg/m3) mengikuti satuan umum tiap sensor — perlu dicek ulang terhadap datasheet masing-masing sensor (SDS011, MH-Z19B, SGP30, MiCS-4514) saat implementasi agar konsisten dengan output aktualnya.

### 3.4 `thresholds`

Batas normal per parameter, mengacu ke standar baku mutu (Kemenkes/WHO/ASHRAE — akan diisi setelah acuan final diberikan). Dipisah dari kode agar mudah diubah tanpa redeploy firmware/backend.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID (PK) | |
| parameter | TEXT | `pm25`, `pm10`, `no2`, `co2`, `tvoc`, `lux`, `noise_db` |
| min_value | DOUBLE PRECISION | Batas bawah normal (nullable jika tidak ada batas bawah) |
| max_value | DOUBLE PRECISION | Batas atas normal |
| reference | TEXT | Sumber standar, misal "Kemenkes No. X Tahun Y" |
| updated_at | TIMESTAMPTZ | |

```sql
CREATE TABLE thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter TEXT NOT NULL UNIQUE,
  min_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  reference TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.5 `alerts`

Dicatat setiap kali backend mendeteksi parameter di luar batas normal (hasil evaluasi `thresholds`, sumber kebenaran untuk notifikasi & histori — terpisah dari LED lokal di device).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID (PK) | |
| device_id | UUID (FK -> devices.id) | |
| parameter | TEXT | Parameter yang menyimpang |
| value | DOUBLE PRECISION | Nilai saat alert terjadi |
| threshold_id | UUID (FK -> thresholds.id) | |
| triggered_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | Nullable, diisi saat parameter kembali normal |

```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  parameter TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  threshold_id UUID REFERENCES thresholds(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_device_triggered
  ON alerts (device_id, triggered_at DESC);
```

### 3.6 `device_push_tokens`

Menyimpan token FCM per instalasi app, untuk pengiriman push notification.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID (PK) | |
| fcm_token | TEXT (UNIQUE) | |
| platform | TEXT | `android` / `ios` |
| created_at | TIMESTAMPTZ | |

```sql
CREATE TABLE device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fcm_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Catatan: tabel ini belum dikaitkan ke tabel `users` karena role/user management masih didiskusikan (lihat `prd.md` bagian Open Questions). Kalau nanti multi-role user difinalkan, tambahkan kolom `user_id` (FK) di sini.

## 4. Query Contoh

**Data terkini per device:**
```sql
SELECT * FROM sensor_readings
WHERE device_id = $1
ORDER BY time DESC
LIMIT 1;
```

**Histori dengan rentang waktu:**
```sql
SELECT * FROM sensor_readings
WHERE device_id = $1
  AND time BETWEEN $2 AND $3
ORDER BY time ASC;
```

**Agregasi harian (pakai fungsi bawaan PostgreSQL `date_trunc`) untuk export:**
```sql
SELECT
  date_trunc('day', time) AS day,
  avg(pm25) AS avg_pm25,
  avg(pm10) AS avg_pm10,
  avg(no2) AS avg_no2,
  avg(co2) AS avg_co2,
  avg(tvoc) AS avg_tvoc,
  avg(lux) AS avg_lux,
  avg(noise_db) AS avg_noise_db
FROM sensor_readings
WHERE device_id = $1
  AND time >= date_trunc('day', $2::timestamptz)
  AND time < date_trunc('day', $2::timestamptz) + interval '1 day'
GROUP BY day;
```

## 5. Item yang Masih Terbuka

- Kebijakan retensi data lama (belum ditentukan apakah data dihapus/diarsip setelah periode tertentu, mengingat tidak ada fitur retention policy otomatis seperti di TimescaleDB).
- Tabel `users`/role akan ditambahkan setelah keputusan role difinalkan.
- Satuan pasti tiap parameter perlu divalidasi ulang terhadap datasheet sensor saat implementasi.
- Struktur tabel untuk sistem rekomendasi ML (misal tabel `recommendations`) menyusul setelah desain ML difinalkan.
