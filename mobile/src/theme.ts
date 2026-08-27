// Design tokens ported from design/UF IAQ.dc.html (Claude Design prototype).
// Centralized here instead of repeating hex literals across screens/
// components (rule.md section 3: no magic numbers/values scattered).
//
// The design was reworked to a softer, rounded visual language (Inter
// font, no hard black borders) - these tokens match that revision, not
// the earlier bordered/high-contrast look.
//
// Font: the design uses Google Fonts "Inter" via a <link> tag, which
// only works in a browser/webview - React Native has no CSS @font-face
// equivalent without bundling the .ttf files as native assets and
// relinking. FONT_FAMILY below falls back to the platform system font;
// swap in a bundled Inter font later if pixel-exact typography matters
// more than avoiding a native rebuild.
import { Platform } from 'react-native';
import type { PredictionLabel } from './services/api';

export const colors = {
  ink: '#1c1c1e',
  body: '#eef0ee',
  surface: '#f7f8f6', // card backgrounds
  surfaceMuted: '#f0f1ef', // icon boxes, inactive pill background
  surfaceHover: '#eff1ee',
  mutedText: '#4d564f',
  faintText: '#98A2A0',
  border: '#e6e8e4',
  borderStrong: '#cfd2cc',
  white: '#ffffff',

  // Brand palette: base = #B2D959 (lime), second = #FED24F (gold), per
  // user color-pattern request. Both are bright/light on their own, so
  // each gets derived darker/paler shades at the same hue for text and
  // background contexts (same 2-tier pattern the old green/amber values
  // already used) - `green`/`amber*` keys are kept as-is since lime and
  // gold are still each a shade of green/amber-yellow; only the hex
  // values changed, so no call site needed renaming.
  green: '#76962C', // base (#B2D959), darkened for text/icon/button contrast on white
  greenDark: '#465B15', // base, darkened further for text on greenBg
  greenBg: '#F1F6E6', // base, pale tint background
  greenLine: '#B2D959', // base as given - bright enough to use directly for dots/lines/pulses

  amber: '#FED24F', // second as given - solid fills/dashed lines/badges
  amberLight: '#F9DC86', // second, lightened (paler tier, above attention/below amberBg)
  amberBg: '#FAF5E5', // second, pale tint background
  amberText: '#84660B', // second, darkened for text on amberBg

  // "Perhatian" tier - a lighter/less-saturated shade than "Sedang"
  // (colors.amber*), matching the design's 4-tier status scale.
  attention: '#987716',
  attentionBg: '#FBF8EF',
  attentionDot: '#F9DC86',

  red: '#E53935',
  redDark: '#B71C1C',
  redBg: '#FDECEA',
} as const;

// Shared corner radii so cards/pills stay consistent across screens
// instead of each screen picking its own number (rule.md 3).
export const radius = {
  sm: 11,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  pill: 999,
} as const;

// Status tone lookup - mirrors the design's `tone()` helper. The rule-based
// per-parameter status (schema.md `alerts`) only ever reports 'normal' /
// 'not_normal', so 'attention'/'medium' are used by the Prediction screen's
// 4-class composite result instead (BiGRU classifier via
// screens/PredictionScreen.tsx): Baik -> normal, Rawan -> attention,
// Peringatan -> medium, Bahaya -> not_normal.
export const statusTone = {
  normal: { fg: colors.greenDark, bg: colors.greenBg, dot: colors.greenLine },
  attention: { fg: colors.attention, bg: colors.attentionBg, dot: colors.attentionDot },
  medium: { fg: colors.amberText, bg: colors.amberBg, dot: colors.amber },
  not_normal: { fg: colors.redDark, bg: colors.redBg, dot: colors.red },
  unknown: { fg: colors.mutedText, bg: colors.surfaceMuted, dot: colors.faintText },
} as const;

// Maps the BiGRU classifier's 4 composite labels onto statusTone above.
// Shared here (rather than duplicated per screen) since both
// PredictionScreen.tsx and DashboardScreen.tsx's AI pill display the same
// prediction result.
export const predictionLabelTone: Record<PredictionLabel, keyof typeof statusTone> = {
  Baik: 'normal',
  Rawan: 'attention',
  Peringatan: 'medium',
  Bahaya: 'not_normal',
};

export const FONT_FAMILY = Platform.select({ android: 'sans-serif', ios: undefined, default: undefined });
