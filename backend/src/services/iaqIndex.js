// Composite "IAQ index" for the mobile Dashboard's gauge - separate from
// threshold.js's binary normal/not_normal per-parameter alerts (that
// module stays unchanged, see CLAUDE.md's "rule-based/ML split" note).
// This is a *new* scoring formula, added 2026-09-13 to replace
// mobile/src/utils/iaqScore.ts's old placeholder heuristic (percentage
// of parameters "normal" - which read 100 for every device until real
// `thresholds` rows exist, see that file's old comment), so the score
// actually reflects real readings.
//
// Methodology: adapted from Indonesia's official ISPU (Indeks Standar
// Pencemar Udara, Peraturan Menteri LHK No.
// P.14/MENLHK/SETJEN/KUM.1/7/2020) sub-index formula - each parameter's
// raw value is linearly interpolated between breakpoint pairs onto a
// 0/50/100/200/300+ scale with labels Baik/Sedang/Tidak
// Sehat/Sangat Tidak Sehat/Berbahaya. ISPU itself only defines
// breakpoints for PM10/PM2.5/NO2 (it's an *ambient outdoor* pollution
// index) - CO2/TVOC/noise/lux breakpoints below are this project's own
// extension onto the same numeric scale, each cited to a real guideline
// but not one single official Indonesian regulation the way PM/NO2 are.
// Treat those four as a documented judgment call, not settled fact -
// revisit before citing in the thesis as more than "adapted from X".
//
// Combining the 7 per-parameter sub-indices into one composite score:
// user-confirmed 2026-09-13 to use a WEIGHTED AVERAGE (not ISPU's own
// "worst pollutant wins" max rule) - smoother, but a departure from how
// real ISPU/AQI combine sub-indices, so this is explicitly a simplified
// adaptation, not the official method. Weights are this project's own
// judgment (relative health-impact ranking), not from a cited study -
// revisit if a formal weighting method (AHP, entropy weighting, etc.)
// is wanted instead.
//
// Sources (fetched/verified 2026-09-13, see conversation for exact
// quotes):
// - PM10/PM2.5/NO2 breakpoints: Peraturan Menteri LHK No.
//   P.14/MENLHK/SETJEN/KUM.1/7/2020 tentang Indeks Standar Pencemar
//   Udara (peraturan.go.id).
// - CO2 bands: adapted from ASHRAE's position on indoor CO2 (~700ppm
//   above outdoor / commonly-cited ~1000ppm acceptable ceiling) -
//   ASHRAE 62.1 itself does NOT define pass/fail categories (a common
//   misconception, per ashrae.org's own position document), so these
//   bands are a practical adaptation, not an ASHRAE-defined table.
// - TVOC bands (ppb): adapted from the German UBA/Seifert (1999)
//   5-level mg/m3 hygiene scale, converted to the ppb-scale TVOC index
//   convention used by gas-sensor-class devices (this project's SGP30),
//   since UBA's original scale is defined for real chemical
//   concentrations in mg/m3, not a sensor's internal ppb index - treat
//   the ppb numbers here as a practical approximation, not a direct
//   unit conversion of UBA's figures.
// - Noise/lux: Kepmenkes RI No. 1204/Menkes/SK/X/2004 (Persyaratan
//   Kesehatan Lingkungan Rumah Sakit) - "ruang perawatan" limits are
//   45 dBA (noise) and 250 lux waking / 50 lux sleeping (lighting).
//   ISPU-style multi-tier bands around those single regulatory numbers
//   are this project's own extrapolation (Kepmenkes gives one limit per
//   room type, not a 5-tier scale).

// NO2 sensor readings are stored/reported in ppm (schema.md), but ISPU's
// NO2 breakpoints are in µg/m3 - this conversion is required before
// evaluating NO2's sub-index. 1 ppm NO2 = 1.882 mg/m3 = 1882 µg/m3 at
// 25°C/1atm (NO2 molar mass 46.01 g/mol / molar volume 24.45 L/mol).
const NO2_PPM_TO_UGM3 = 1882;

// Ideal lighting band per Kepmenkes 1204/2004 (50 lux sleeping - 250 lux
// waking); this system has no signal for which state a patient is in,
// so both bounds are treated as one acceptable range. Sub-index is
// based on distance outside this band (0 if inside it), not the raw
// lux value itself.
const LUX_IDEAL_MIN = 50;
const LUX_IDEAL_MAX = 250;

// Each entry: { ispuLo, ispuHi, xLo, xHi } - value in [xLo, xHi] maps
// linearly to ISPU in [ispuLo, ispuHi], same interpolation ISPU itself
// uses. Bands must be given lowest-to-highest; the last band's slope is
// used to extrapolate beyond its xHi rather than capping, so a severe
// outlier still produces a severe (not flat-lined) score.
const BREAKPOINTS = {
  pm10: [
    { ispuLo: 0, ispuHi: 50, xLo: 0, xHi: 50 },
    { ispuLo: 50, ispuHi: 100, xLo: 50, xHi: 150 },
    { ispuLo: 100, ispuHi: 200, xLo: 150, xHi: 350 },
    { ispuLo: 200, ispuHi: 300, xLo: 350, xHi: 420 },
    { ispuLo: 300, ispuHi: 500, xLo: 420, xHi: 500 },
  ],
  pm25: [
    { ispuLo: 0, ispuHi: 50, xLo: 0, xHi: 15.5 },
    { ispuLo: 50, ispuHi: 100, xLo: 15.5, xHi: 55.4 },
    { ispuLo: 100, ispuHi: 200, xLo: 55.4, xHi: 150.4 },
    { ispuLo: 200, ispuHi: 300, xLo: 150.4, xHi: 250.4 },
    { ispuLo: 300, ispuHi: 500, xLo: 250.4, xHi: 500 },
  ],
  // In µg/m3 - convert a raw ppm reading with NO2_PPM_TO_UGM3 first.
  no2: [
    { ispuLo: 0, ispuHi: 50, xLo: 0, xHi: 80 },
    { ispuLo: 50, ispuHi: 100, xLo: 80, xHi: 200 },
    { ispuLo: 100, ispuHi: 200, xLo: 200, xHi: 1130 },
    { ispuLo: 200, ispuHi: 300, xLo: 1130, xHi: 2260 },
    { ispuLo: 300, ispuHi: 500, xLo: 2260, xHi: 3000 },
  ],
  co2: [
    { ispuLo: 0, ispuHi: 50, xLo: 0, xHi: 800 },
    { ispuLo: 50, ispuHi: 100, xLo: 800, xHi: 1000 },
    { ispuLo: 100, ispuHi: 200, xLo: 1000, xHi: 1500 },
    { ispuLo: 200, ispuHi: 300, xLo: 1500, xHi: 2500 },
    { ispuLo: 300, ispuHi: 500, xLo: 2500, xHi: 5000 },
  ],
  tvoc: [
    { ispuLo: 0, ispuHi: 50, xLo: 0, xHi: 220 },
    { ispuLo: 50, ispuHi: 100, xLo: 220, xHi: 660 },
    { ispuLo: 100, ispuHi: 200, xLo: 660, xHi: 2200 },
    { ispuLo: 200, ispuHi: 300, xLo: 2200, xHi: 5500 },
    { ispuLo: 300, ispuHi: 500, xLo: 5500, xHi: 11000 },
  ],
  noise_db: [
    { ispuLo: 0, ispuHi: 50, xLo: 0, xHi: 35 },
    { ispuLo: 50, ispuHi: 100, xLo: 35, xHi: 45 },
    { ispuLo: 100, ispuHi: 200, xLo: 45, xHi: 55 },
    { ispuLo: 200, ispuHi: 300, xLo: 55, xHi: 70 },
    { ispuLo: 300, ispuHi: 500, xLo: 70, xHi: 100 },
  ],
  // Applied to distance-outside-ideal-band (lux), not raw lux - see
  // buildLuxDeviation() below.
  lux: [
    { ispuLo: 0, ispuHi: 50, xLo: 0, xHi: 0 },
    { ispuLo: 50, ispuHi: 100, xLo: 0, xHi: 50 },
    { ispuLo: 100, ispuHi: 200, xLo: 50, xHi: 100 },
    { ispuLo: 200, ispuHi: 300, xLo: 100, xHi: 150 },
    { ispuLo: 300, ispuHi: 500, xLo: 150, xHi: 300 },
  ],
};

// User-confirmed 2026-09-13 weighting (relative health-impact judgment,
// not from a cited weighting study - see file header). Must sum to 1.
const WEIGHTS = {
  pm25: 0.25,
  co2: 0.15,
  pm10: 0.15,
  no2: 0.15,
  tvoc: 0.15,
  noise_db: 0.1,
  lux: 0.05,
};

const CATEGORY_BANDS = [
  { max: 50, category: "Baik" },
  { max: 100, category: "Sedang" },
  { max: 200, category: "Tidak Sehat" },
  { max: 300, category: "Sangat Tidak Sehat" },
  { max: Infinity, category: "Berbahaya" },
];

function categoryForValue(value) {
  return CATEGORY_BANDS.find((band) => value <= band.max).category;
}

// Linear interpolation within the matching breakpoint band; extrapolates
// past the last band's xHi using that band's own slope rather than
// capping, so an extreme reading still produces an escalating (not
// flat) sub-index. Values below the first band's xLo (shouldn't happen
// for a real non-negative reading) clamp to that band's ispuLo.
function interpolateSubIndex(value, bands) {
  if (value <= bands[0].xLo) return bands[0].ispuLo;

  const band = bands.find((b) => value <= b.xHi) ?? bands[bands.length - 1];
  const slope = (band.ispuHi - band.ispuLo) / (band.xHi - band.xLo || 1);
  return band.ispuLo + slope * (value - band.xLo);
}

function buildLuxDeviation(luxValue) {
  if (luxValue >= LUX_IDEAL_MIN && luxValue <= LUX_IDEAL_MAX) return 0;
  return luxValue < LUX_IDEAL_MIN ? LUX_IDEAL_MIN - luxValue : luxValue - LUX_IDEAL_MAX;
}

// reading: object with (a subset of) the 7 official parameter fields,
// same shape as a sensor_readings row / GET .../latest response.
// Missing/null parameters are skipped and their weight is redistributed
// proportionally across the parameters actually present, rather than
// treated as 0 (which would silently punish/reward a reading for a
// sensor that simply isn't installed yet - same fail-safe spirit as
// services/ml.js's buildWindowPayload()).
export function computeIaqIndex(reading) {
  const breakdown = [];
  let weightedSum = 0;
  let weightPresent = 0;

  for (const parameter of Object.keys(WEIGHTS)) {
    const value = reading[parameter];
    if (value === null || value === undefined) continue;

    const inputValue = parameter === "no2" ? value * NO2_PPM_TO_UGM3 : value;
    const forInterpolation = parameter === "lux" ? buildLuxDeviation(inputValue) : inputValue;
    const subIndex = interpolateSubIndex(forInterpolation, BREAKPOINTS[parameter]);
    const weight = WEIGHTS[parameter];

    breakdown.push({
      parameter,
      value,
      subIndex: Math.round(subIndex * 10) / 10,
      category: categoryForValue(subIndex),
    });
    weightedSum += subIndex * weight;
    weightPresent += weight;
  }

  if (weightPresent === 0) return null; // no evaluable parameters at all

  const value = Math.round((weightedSum / weightPresent) * 10) / 10;
  return { value, category: categoryForValue(value), breakdown };
}
