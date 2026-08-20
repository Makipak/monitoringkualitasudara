# Rules - Hospital Air Quality Monitoring System

## 1. Tujuan Dokumen

Dokumen ini berisi aturan wajib untuk penulisan kode, pemilihan dependency, dan dokumentasi di seluruh bagian proyek (firmware, backend, mobile app).

## 2. Versi & Dependency

- Dilarang menggunakan package/library yang berstatus **deprecated** atau **unmaintained** (tidak ada update > 1-2 tahun, atau sudah ada pengumuman resmi deprecated dari maintainer).
- Sebelum menambah dependency baru, cek status maintenance-nya (repository masih aktif, tidak ada warning deprecated di npm/PyPI).
- Gunakan versi stabil terbaru yang didukung aktif per saat development (bukan sekadar versi terlama yang "masih jalan"). Baseline acuan saat dokumen ini dibuat (Agustus 2026):
  | Layer | Tool | Versi Acuan |
  |---|---|---|
  | Backend runtime | Node.js | LTS aktif (Node 24.x ke atas) |
  | Mobile app | React Native | Versi stabil terbaru (0.8x ke atas), New Architecture (Fabric) aktif |
  | Mobile app | React | 19.x |
  | Firmware | Arduino Core / PlatformIO | Versi terbaru yang kompatibel dengan ESP32 DevKitC V4 |
  | Database | PostgreSQL (Supabase) | Versi Postgres yang disediakan Supabase (dicek langsung di dashboard project) |
- Versi acuan di atas wajib dicek ulang saat mulai implementasi karena rilis baru dapat muncul kapan saja; jangan pin ke versi lama tanpa alasan.
- Jika suatu library sudah deprecated di tengah jalan proyek, wajib dicari penggantinya, bukan dibiarkan.

## 3. Struktur & Penulisan Kode

- Bahasa pemrograman: JavaScript/TypeScript untuk backend dan mobile app (TypeScript diutamakan untuk type safety), C++ (Arduino framework) untuk firmware.
- Penamaan variabel dan fungsi menggunakan Bahasa Inggris, deskriptif, tidak disingkat berlebihan.
- Konfigurasi sensitif (API key, credential MQTT, JWT secret) wajib disimpan di environment variable (`.env`), tidak boleh hardcode di kode maupun ter-commit ke repository.
- Setiap modul/fungsi utama memiliki tanggung jawab tunggal (single responsibility) — hindari satu file berisi logic device, backend, dan app tercampur.

## 4. Dokumentasi

- Dokumentasi (README, komentar kode, file `.md` lain) ditulis **singkat namun jelas** — jelaskan apa dan kenapa, hindari penjelasan bertele-tele.
- **Tidak menggunakan emoji** di seluruh dokumen proyek maupun di README/komentar kode, termasuk pada bagian yang sudah ada di project React Native.
- Setiap dokumen baru (`*.md`) menggunakan format heading yang konsisten (`#`, `##`, `###`) tanpa dekorasi tambahan yang tidak perlu.
- Perubahan besar pada arsitektur atau keputusan teknis dicatat singkat di `architecture.md`, bukan tersebar di banyak file.

## 5. Firmware (ESP32)

- Interval pengiriman data ke MQTT broker didefinisikan sebagai konstanta di awal file, bukan angka literal tersebar di kode (magic number).
- Batas normal (threshold) tiap parameter didefinisikan di satu tempat (misal file konfigurasi/header terpisah) agar mudah diubah saat standar baku mutu final tersedia.
- Logic pembacaan sensor dan logic tampilan (TFT, via `TFT_eSPI`) dipisah menjadi fungsi berbeda.

## 6. Backend

- REST API mengikuti konvensi RESTful standar (resource-based endpoint, HTTP method sesuai fungsinya).
- Autentikasi API menggunakan token (JWT), tidak menyimpan session di memory server yang tidak persist.
- Koneksi MQTT ke HiveMQ Cloud wajib menggunakan TLS (port 8883), tidak menggunakan koneksi plain.
- Query ke TimescaleDB untuk data historis menggunakan index pada kolom timestamp untuk menjaga performa.

## 7. Mobile App (React Native)

- Struktur folder mengikuti pemisahan yang jelas (screens, components, services/api, hooks) agar konsisten dengan project yang sudah ada.
- State management dan pemanggilan API dipisahkan dari komponen UI.
- Update dokumentasi project React Native yang sudah ada mengikuti aturan pada bagian 4 (dokumentasi singkat, tanpa emoji).

## 8. Review & Update Aturan

Dokumen ini adalah living document — dapat diperbarui seiring proyek berjalan (misal setelah keputusan role user atau sistem rekomendasi ML difinalkan bersama tim).
