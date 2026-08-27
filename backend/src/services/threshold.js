// Rule-based threshold evaluation (architecture.md section 4.2a) - the
// interim replacement for the ML recommendation system, which is still
// undecided (prd.md "Open Questions"). Compares each of the 7 official
// parameters against the `thresholds` table (fetched by services/db.js)
// and returns one entry per parameter currently out of range, each with a
// fixed recommendation string. Pure function - no I/O - so it is testable
// without a database.
import { OFFICIAL_PARAMETERS } from "../config.js";

const RECOMMENDATIONS = {
  pm25: {
    high: "Kadar PM2.5 tinggi. Periksa sumber partikel (asap, debu) dan tingkatkan ventilasi/filtrasi udara ruangan.",
    low: "Kadar PM2.5 di bawah batas bawah. Periksa kalibrasi sensor.",
  },
  pm10: {
    high: "Kadar PM10 tinggi. Periksa sumber debu dan tingkatkan ventilasi/filtrasi udara ruangan.",
    low: "Kadar PM10 di bawah batas bawah. Periksa kalibrasi sensor.",
  },
  no2: {
    high: "Kadar NO2 tinggi. Periksa sumber pembakaran/gas buang di sekitar ruangan dan tingkatkan ventilasi.",
    low: "Kadar NO2 di bawah batas bawah. Periksa kalibrasi sensor.",
  },
  co2: {
    high: "Kadar CO2 tinggi. Tingkatkan sirkulasi udara segar dan periksa jumlah orang di ruangan.",
    low: "Kadar CO2 di bawah batas bawah. Periksa kalibrasi sensor.",
  },
  tvoc: {
    high: "Kadar TVOC tinggi. Periksa sumber senyawa organik volatil (bahan kimia, cat, disinfektan) dan tingkatkan ventilasi.",
    low: "Kadar TVOC di bawah batas bawah. Periksa kalibrasi sensor.",
  },
  lux: {
    high: "Pencahayaan terlalu terang. Sesuaikan intensitas lampu/tirai ruangan.",
    low: "Pencahayaan terlalu redup. Tambah intensitas lampu ruangan.",
  },
  noise_db: {
    high: "Tingkat kebisingan tinggi. Identifikasi sumber suara dan kurangi jika memungkinkan.",
    low: "Tingkat kebisingan di bawah batas bawah. Periksa kalibrasi sensor.",
  },
};

// reading: object with the 7 official parameter fields (missing/undefined
// fields, e.g. a sensor that failed to read this cycle, are skipped).
// thresholds: rows from the `thresholds` table (schema.md 3.4).
export function evaluateThresholds(reading, thresholds) {
  const alerts = [];

  for (const parameter of OFFICIAL_PARAMETERS) {
    const value = reading[parameter];
    if (value === undefined || value === null) continue;

    const threshold = thresholds.find((t) => t.parameter === parameter);
    if (!threshold) continue; // not configured yet - fail safe, no alert (see sql/seed.sql)

    let direction = null;
    if (threshold.max_value !== null && value > threshold.max_value) direction = "high";
    else if (threshold.min_value !== null && value < threshold.min_value) direction = "low";
    if (!direction) continue;

    alerts.push({
      parameter,
      value,
      direction,
      thresholdId: threshold.id,
      recommendation:
        RECOMMENDATIONS[parameter]?.[direction] ??
        "Nilai di luar batas normal, periksa kondisi ruangan.",
    });
  }

  return alerts;
}
