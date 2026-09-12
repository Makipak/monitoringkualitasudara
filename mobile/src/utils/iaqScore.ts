import type { IaqIndex } from '../services/api';
import { statusTone } from '../theme';

// Maps the composite IAQ index's 5 ISPU-style categories
// (backend/src/services/iaqIndex.js) onto this app's existing 4-tone
// status palette (theme.ts statusTone) rather than introducing ISPU's
// own official colors (green/blue/yellow/red/black) - keeps the
// Dashboard visually consistent with the rest of the app (Prediction
// tab's Baik/Rawan/Peringatan/Bahaya use the same 4 tones). There is no
// separate "extreme" tone yet, so Sangat Tidak Sehat and Berbahaya both
// map to the same (red) tone as a deliberate simplification.
export function iaqCategoryTone(category: IaqIndex['category']): keyof typeof statusTone {
  switch (category) {
    case 'Baik':
      return 'normal';
    case 'Sedang':
      return 'attention';
    case 'Tidak Sehat':
      return 'medium';
    case 'Sangat Tidak Sehat':
    case 'Berbahaya':
      return 'not_normal';
    default:
      return 'unknown';
  }
}
