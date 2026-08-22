# PRD - Hospital Air Quality Monitoring System

## 1. Latar Belakang

Kualitas udara di ruangan rumah sakit (terutama ruang perawatan) berdampak langsung pada kesehatan pasien, tenaga medis, dan pengunjung. Parameter seperti PM2.5, PM10, NO2, CO2, TVOC, pencahayaan, dan kebisingan perlu dipantau secara kontinu agar penyimpangan dari standar baku mutu dapat terdeteksi dan ditindaklanjuti sedini mungkin.

Proyek ini merupakan tugas akhir yang membangun sistem monitoring kualitas udara berbasis IoT, terhubung ke aplikasi mobile untuk visualisasi data, notifikasi, dan pelaporan.

## 2. Tujuan

- Memantau 7 parameter kualitas udara ruangan secara real-time: PM2.5, PM10, NO2, CO2, TVOC, pencahayaan, kebisingan.
- Memberikan indikasi visual langsung di perangkat (LED) ketika ada parameter di luar batas normal.
- Menyediakan dashboard mobile yang menampilkan kondisi terkini dan riwayat data.
- Mengirim notifikasi ke pengguna saat ada parameter yang menyimpang dari standar.
- Menyediakan fitur export data harian untuk kebutuhan pelaporan.

## 3. Ruang Lingkup (Scope)

### In Scope (v1)
- 1 unit perangkat IoT untuk 1 ruangan.
- Pengukuran 7 parameter di atas.
- Tampilan nilai real-time di OLED perangkat.
- Indikator LED merah saat parameter keluar dari ambang normal.
- Koneksi device ke cloud melalui MQTT (HiveMQ Cloud) via internet/WiFi.
- Backend menyimpan data historis ke TimescaleDB.
- Mobile app (React Native) menampilkan dashboard, status per parameter, dan riwayat data.
- Push notification saat ada parameter out-of-range.
- Export data harian (format akan ditentukan, kandidat: CSV/PDF).

### Out of Scope (v1, kandidat pengembangan lanjutan)
- Multi-device / multi-ruangan.
- Multi-role user (admin, staff, viewer) — masih didiskusikan, belum difinalkan untuk v1.
- Sistem rekomendasi berbasis Machine Learning — masih dalam diskusi tim, akan didefinisikan di iterasi berikutnya. **Untuk v1, rekomendasi memakai pendekatan rule-based sederhana** (lihat FR-B5 dan `architecture.md` bagian 4.2a), bukan model ML.
- Broker MQTT self-hosted (dipilih HiveMQ Cloud managed untuk v1).

## 4. Pengguna & Stakeholder

- **Pengguna utama:** petugas yang bertanggung jawab memantau kualitas udara ruangan (peran spesifik masih didiskusikan).
- **Stakeholder akademik:** dosen pembimbing/penguji tugas akhir.

## 5. Functional Requirements

### 5.1 Perangkat IoT
| ID | Requirement |
|----|-------------|
| FR-D1 | Perangkat membaca 7 parameter dari sensor terkait (SDS011, MH-Z19B, SGP30, MiCS-4514, BH1750, MAX9814). |
| FR-D2 | Perangkat menampilkan nilai seluruh parameter di layar OLED/TFT. |
| FR-D3 | Perangkat menyalakan LED merah ketika satu atau lebih dari 7 parameter resmi melebihi/di bawah batas normal. |
| FR-D4 | Perangkat mengirim data sensor ke MQTT broker secara berkala melalui koneksi internet. |
| FR-D5 | Perangkat membaca suhu ruangan (GY-SHT31) dan menyertakannya dalam data yang ditampilkan di layar serta dikirim ke MQTT — suhu bersifat informatif saja, tidak termasuk 7 parameter resmi dan tidak memicu LED alert. |

### 5.2 Backend
| ID | Requirement |
|----|-------------|
| FR-B1 | Backend subscribe ke topic MQTT dan menerima data dari perangkat. |
| FR-B2 | Backend menyimpan data sensor (termasuk suhu) ke PostgreSQL (Supabase) beserta timestamp. |
| FR-B3 | Backend menyediakan REST API untuk data historis dan status terkini. |
| FR-B4 | Backend mengirim update real-time ke mobile app (WebSocket). |
| FR-B5 | Backend mengevaluasi 7 parameter resmi terhadap batas normal (rule-based) dan memicu notifikasi beserta rekomendasi tindakan sederhana jika menyimpang. Suhu disimpan dan diteruskan ke app tetapi dikecualikan dari evaluasi ini. |
| FR-B6 | Backend menyediakan endpoint export data harian. |

### 5.3 Mobile App
| ID | Requirement |
|----|-------------|
| FR-A1 | Dashboard menampilkan 7 parameter resmi beserta status (normal/tidak normal), ditambah suhu ruangan sebagai info pendukung tanpa status normal/tidak normal. |
| FR-A2 | Dashboard update secara real-time saat ada data baru. |
| FR-A3 | Pengguna dapat melihat riwayat data per parameter (termasuk suhu). |
| FR-A4 | Pengguna menerima push notification saat ada dari 7 parameter resmi yang out-of-range (suhu tidak memicu notifikasi). |
| FR-A5 | Pengguna dapat melakukan export data harian dari app. |

## 6. Non-Functional Requirements

- **Konektivitas:** device dan app harus dapat bekerja melalui koneksi internet (bukan LAN-only).
- **Keamanan:** koneksi MQTT menggunakan TLS, API backend menggunakan autentikasi token.
- **Reliabilitas:** interval pengiriman data device konsisten (interval final ditentukan saat implementasi, kandidat 30-60 detik).
- **Skalabilitas:** arsitektur backend disiapkan agar dapat menambah device/ruangan di masa depan meski v1 hanya 1 device.
- **Maintainability:** dependency dan library yang dipakai harus versi yang didukung aktif (bukan deprecated), sesuai `rule.md`.

## 7. Ringkasan Arsitektur (Detail di architecture.md)

```
[ESP32 + Sensors] --Internet--> [HiveMQ Cloud] --> [Node.js Backend] --> [TimescaleDB]
                                                          |
                                                          v
                                                [REST API / WebSocket]
                                                          |
                                                          v
                                                 [React Native App]
```

## 8. Standar Baku Mutu

Ambang batas normal tiap parameter akan mengacu pada standar resmi (Kemenkes/WHO/ASHRAE atau standar lain yang relevan untuk ruang rumah sakit). Nilai final akan ditambahkan setelah acuan ditentukan oleh tim.

## 9. Open Questions

- Peran/role pengguna di mobile app.
- Standar baku mutu final per parameter.
- Desain sistem rekomendasi ML (data training, letak inference, trigger) — **untuk v1, evaluasi dan rekomendasi memakai rule-based sederhana** (lihat `architecture.md` bagian 4.2a) sebagai solusi sementara karena model ML belum siap. Desain ML tetap didiskusikan dengan tim untuk iterasi berikutnya, sebagai pelengkap atau pengganti rule-based ini.
- Format file export data harian.

## 10. Success Metrics

- Data 7 parameter berhasil terkirim dari device ke app secara real-time tanpa data loss signifikan.
- Notifikasi terkirim dalam waktu wajar (< beberapa detik) setelah parameter terdeteksi out-of-range.
- Sistem dapat didemokan penuh (end-to-end) saat sidang tugas akhir.
