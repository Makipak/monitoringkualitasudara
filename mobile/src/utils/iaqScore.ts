import type { RoomStatus } from '../services/api';

// Composite "IAQ score" (0-100) for the gauge on design/UF IAQ.dc.html's
// home screen. There is no defined formula for this anywhere in
// schema.md/architecture.md/prd.md - this is a placeholder heuristic
// (percentage of evaluated official parameters currently "normal"), not
// an official metric. Revisit once/if a real scoring formula is decided.
//
// Note: while backend/sql/seed.sql has not seeded any `thresholds` rows,
// the backend's evaluateThresholds() has nothing to compare against and
// marks every present parameter "normal" (fails safe - see
// backend/src/services/threshold.js), so this will read 100 for any
// device that's actually reporting, until real thresholds exist.
export function computeIaqScore(status: RoomStatus['status'] | undefined): number | null {
  if (!status) return null;
  const entries = Object.values(status);
  if (entries.length === 0) return null;

  const normalCount = entries.filter(s => s === 'normal').length;
  return Math.round((normalCount / entries.length) * 100);
}

export function iaqLabel(score: number | null): string {
  if (score === null) return '--';
  if (score >= 80) return 'AMAN';
  if (score >= 60) return 'SEDANG';
  return 'TIDAK AMAN';
}
