// The 7 official parameters (prd.md section 2 / architecture.md 4.1),
// with the display metadata design/UF IAQ.dc.html needs per parameter.
// Single source of truth so screens don't repeat this list - matches the
// same set as backend/src/config.js OFFICIAL_PARAMETERS.
//
// Icon paths: the design only had icons for 5 of these (no2, co2, tvoc,
// lux, noise) - pm25/pm10 icons below are added (Lucide-style "wind"
// glyph, reused for both) since the design dropped PM2.5/PM10 entirely
// but prd.md requires all 7.
export type ParameterKey = 'pm25' | 'pm10' | 'no2' | 'co2' | 'tvoc' | 'lux' | 'noise_db';

export type ParameterDef = {
  key: ParameterKey;
  name: string;
  fullName: string;
  unit: string;
  icon: string;
};

export const PARAMETERS: ParameterDef[] = [
  {
    key: 'pm25',
    name: 'PM2.5',
    fullName: 'Particulate Matter 2.5',
    unit: 'ug/m3',
    icon: 'M9.59 4.59A2 2 0 1 1 11 8H2M12.59 11.59A2 2 0 1 1 14 15H2M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2',
  },
  {
    key: 'pm10',
    name: 'PM10',
    fullName: 'Particulate Matter 10',
    unit: 'ug/m3',
    icon: 'M9.59 4.59A2 2 0 1 1 11 8H2M12.59 11.59A2 2 0 1 1 14 15H2M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2',
  },
  {
    key: 'no2',
    name: 'NO2',
    fullName: 'Nitrogen Dioksida',
    unit: 'ppm',
    icon: 'M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.6 4.6A2 2 0 1 1 11 8H2',
  },
  {
    key: 'co2',
    name: 'CO2',
    fullName: 'Karbon Dioksida',
    unit: 'ppm',
    icon: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
  },
  {
    key: 'tvoc',
    name: 'TVOC',
    fullName: 'Total Volatile Organic Compounds',
    unit: 'ppb',
    icon: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z',
  },
  {
    key: 'lux',
    name: 'Cahaya',
    fullName: 'Intensitas Cahaya',
    unit: 'lux',
    icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  },
  {
    key: 'noise_db',
    name: 'Kebisingan',
    fullName: 'Tingkat Kebisingan',
    unit: 'dB',
    icon: 'M11 5 6 9H2v6h4l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7',
  },
];
