/**
 * threshold.js
 *
 * Rule-based evaluation untuk 7 parameter resmi kualitas udara.
 * Ini SOLUSI SEMENTARA menggantikan sistem rekomendasi ML yang belum siap
 * (lihat prd.md - Open Questions, dan architecture.md bagian 4.1).
 *
 * Cara kerja:
 * 1. evaluateThresholds() dipanggil tiap kali data sensor baru diterima dari MQTT
 * 2. Membandingkan tiap parameter terhadap batas min/max dari tabel `thresholds` (schema.md)
 * 3. Jika ada parameter di luar batas, hasilkan objek alert + teks rekomendasi
 *
 * Catatan: nilai `min`/`max` di RECOMMENDATIONS bukan angka final — ini placeholder,
 * angka sebenarnya diambil dari tabel `thresholds` di database (bukan hardcode di sini),
 * supaya bisa diubah tanpa redeploy kode begitu standar baku mutu final (Kemenkes/WHO/ASHRAE)
 * sudah ditentukan.
 */

/**
 * Rekomendasi per parameter, per arah penyimpangan (rendah/tinggi).
 * Teks ini generik (bukan saran medis), fokus ke tindakan lingkungan/fasilitas.
 */
const RECOMMENDATIONS = {
  pm25: {
    high: "PM2.5 melebihi batas normal. Periksa dan aktifkan/tingkatkan filtrasi udara (HEPA filter), batasi aktivitas yang menimbulkan partikel (renovasi, pembersihan kering) di sekitar ruangan.",
    low: "PM2.5 di bawah batas normal minimum. Tidak ada tindakan mendesak, kondisi udara relatif bersih.",
  },
  pm10: {
    high: "PM10 melebihi batas normal. Periksa sumber debu/partikel kasar di sekitar ruangan, pastikan sistem filtrasi udara berfungsi optimal.",
    low: "PM10 di bawah batas normal minimum. Tidak ada tindakan mendesak.",
  },
  no2: {
    high: "NO2 melebihi batas normal. Periksa sumber pembakaran/gas buang di sekitar ruangan, tingkatkan ventilasi.",
    low: "NO2 di bawah batas normal minimum. Tidak ada tindakan mendesak.",
  },
  co2: {
    high: "CO2 melebihi batas normal, indikasi ventilasi kurang memadai untuk jumlah orang di ruangan. Tingkatkan sirkulasi udara segera (buka ventilasi/aktifkan exhaust fan).",
    low: "CO2 di bawah batas normal minimum. Tidak ada tindakan mendesak.",
  },
  tvoc: {
    high: "TVOC melebihi batas normal. Periksa sumber bahan kimia/senyawa organik volatil (produk pembersih, cat, desinfektan), tingkatkan ventilasi.",
    low: "TVOC di bawah batas normal minimum. Tidak ada tindakan mendesak.",
  },
  lux: {
    high: "Tingkat pencahayaan melebihi batas normal. Periksa dan sesuaikan intensitas pencahayaan ruangan.",
    low: "Tingkat pencahayaan di bawah batas normal. Tambah pencahayaan ruangan agar sesuai standar kenyamanan visual.",
  },
  noise_db: {
    high: "Tingkat kebisingan melebihi batas normal. Identifikasi sumber suara dan minimalkan gangguan di sekitar ruangan.",
    low: "Tingkat kebisingan di bawah batas normal minimum. Tidak ada tindakan mendesak.",
  },
};

/**
 * Evaluasi satu reading sensor terhadap daftar threshold dari database.
 *
 * @param {Object} reading - data sensor, contoh: { pm25: 40, co2: 1200, ... }
 *                           (field `temperature` sengaja diabaikan, lihat architecture.md)
 * @param {Array}  thresholds - baris dari tabel `thresholds`, format:
 *                           [{ parameter: "pm25", min_value: 0, max_value: 35, reference: "..." }, ...]
 * @returns {Array} daftar alert, kosong jika semua parameter normal. Contoh 1 item:
 *   {
 *     parameter: "co2",
 *     direction: "high",       // "high" atau "low"
 *     value: 1200,
 *     threshold_id: "...",     // dipakai untuk FK ke tabel alerts
 *     min_value: 400,
 *     max_value: 1000,
 *     recommendation: "CO2 melebihi batas normal, ..."
 *   }
 */
function evaluateThresholds(reading, thresholds) {
  const alerts = [];

  for (const threshold of thresholds) {
    const { parameter, min_value, max_value, id: threshold_id } = threshold;
    const value = reading[parameter];

    // Lewati kalau parameter tidak ada di reading (misal payload tidak lengkap)
    if (value === undefined || value === null) continue;

    let direction = null;
    if (max_value !== null && value > max_value) direction = "high";
    else if (min_value !== null && value < min_value) direction = "low";

    if (direction) {
      const recommendation =
        RECOMMENDATIONS[parameter]?.[direction] ??
        `${parameter} berada di luar batas normal (${direction}).`;

      alerts.push({
        parameter,
        direction,
        value,
        threshold_id,
        min_value,
        max_value,
        recommendation,
      });
    }
  }

  return alerts;
}

module.exports = { evaluateThresholds, RECOMMENDATIONS };
