// Educational reference copy for ParameterDetailScreen's "Tentang" /
// "Dampak Kesehatan" / "Tips" sections (design/UF IAQ.dc.html's per-
// parameter about/healthImpact/recActions, adapted).
//
// Deliberately generic - no specific numeric ranges. The design's mockup
// hardcodes example thresholds (e.g. "0-40 ug/m3"), but the project's
// actual standard values are still an open question: schema.md's
// `thresholds` table is intentionally unseeded (see
// backend/sql/seed.sql), so there is no officially decided number to
// show here yet. Revisit once real threshold values are decided and
// exposed via the API.
import type { ParameterKey } from './parameters';

export type ParameterInfo = {
  about: string;
  healthImpact: string;
  tips: string[];
};

export const PARAMETER_INFO: Record<ParameterKey, ParameterInfo> = {
  pm25: {
    about:
      'PM2.5 adalah partikel halus di udara berukuran sangat kecil (di bawah 2.5 mikron) sehingga dapat terhirup jauh ke dalam saluran pernapasan.',
    healthImpact:
      'Paparan PM2.5 dalam jangka panjang berisiko memperburuk fungsi paru-paru dan kondisi pernapasan, terutama pada pasien yang sedang pemulihan.',
    tips: ['Tingkatkan filtrasi/ventilasi udara ruangan.', 'Periksa sumber asap atau debu halus di sekitar ruangan.'],
  },
  pm10: {
    about:
      'PM10 adalah partikel debu di udara yang berukuran lebih besar dari PM2.5, umumnya berasal dari debu, serbuk, dan sisa partikel pembakaran.',
    healthImpact:
      'Paparan PM10 dapat mengiritasi saluran pernapasan bagian atas dan memperberat kondisi pasien dengan gangguan pernapasan.',
    tips: ['Jaga kebersihan ruangan untuk mengurangi debu.', 'Tingkatkan ventilasi/filtrasi udara ruangan.'],
  },
  no2: {
    about:
      'Nitrogen dioksida (NO2) adalah gas pencemar yang umumnya berasal dari proses pembakaran, dan dapat mengiritasi sistem pernapasan jika terhirup dalam jumlah berlebih.',
    healthImpact:
      'Paparan NO2 yang tinggi dapat mengiritasi saluran pernapasan dan memperparah kondisi seperti asma, terutama pada pasien dengan gangguan pernapasan.',
    tips: ['Tingkatkan ventilasi ruangan secara berkala.', 'Periksa dan kurangi sumber pembakaran/gas buang di sekitar ruangan.'],
  },
  co2: {
    about:
      'Karbon dioksida (CO2) menumpuk di udara ruangan saat sirkulasi udara kurang memadai, dan menjadi indikator utama seberapa baik ventilasi suatu ruangan.',
    healthImpact:
      'Kadar CO2 yang tinggi dalam ruangan tertutup dapat menyebabkan kelelahan, sakit kepala, dan menurunkan konsentrasi penghuni ruangan.',
    tips: ['Perbaiki sirkulasi udara ruangan.', 'Tingkatkan asupan udara segar dari luar secara berkala.'],
  },
  tvoc: {
    about:
      'TVOC (Total Volatile Organic Compounds) mengukur total senyawa organik yang mudah menguap dari material bangunan, cat, produk pembersih, dan disinfektan.',
    healthImpact:
      'Paparan TVOC berlebih dapat menyebabkan iritasi mata, hidung, dan tenggorokan, serta memicu sakit kepala pada paparan jangka panjang.',
    tips: ['Identifikasi dan kurangi sumber senyawa organik volatil di ruangan.', 'Gunakan material dan produk pembersih dengan emisi rendah.'],
  },
  lux: {
    about:
      'Intensitas cahaya yang tepat mendukung kenyamanan visual dan membantu menjaga ritme sirkadian pasien selama masa pemulihan.',
    healthImpact:
      'Pencahayaan yang terlalu redup atau terlalu terang dapat mengganggu kenyamanan, kualitas istirahat, dan pemulihan pasien.',
    tips: ['Sesuaikan intensitas lampu ruangan sesuai kebutuhan aktivitas.', 'Gunakan tirai untuk mengatur cahaya alami yang masuk.'],
  },
  noise_db: {
    about:
      'Tingkat kebisingan mengukur intensitas suara di ruangan; kondisi yang tenang penting untuk mendukung istirahat dan pemulihan pasien.',
    healthImpact:
      'Kebisingan berlebih dapat mengganggu kualitas tidur dan istirahat pasien, serta meningkatkan tingkat stres.',
    tips: ['Kurangi kebisingan dari peralatan yang tidak diperlukan.', 'Terapkan jam kunjungan/aktivitas yang lebih tenang di ruangan pemulihan.'],
  },
};
