// Copy this file to `env.ts` (gitignored, rule.md section 3 - never commit
// real values) and fill in real values.
//   cp src/config/env.example.ts src/config/env.ts
//
// A physical phone cannot reach the backend via "localhost" - that
// resolves to the phone itself, not your laptop. Use your laptop's LAN IP
// (same WiFi network as the phone) - find it with `ip addr` (Linux/macOS)
// or `ipconfig` (Windows). An Android emulator (not a physical device)
// can instead use the special alias 10.0.2.2 for its host machine.

export const API_BASE_URL = 'http://192.168.1.100:3000';

// Placeholder shared-secret auth (see backend/README.md "Known
// placeholders") - trades this for a JWT via POST /api/auth/token. Must
// match APP_ACCESS_KEY in backend/.env exactly.
export const APP_ACCESS_KEY = 'change-this-shared-key';

// v1 scope is a single device/room (prd.md section 3) - matches
// firmware/include/config.h DEVICE_ID and backend/sql/seed.sql.
export const DEFAULT_DEVICE_ID = 'room-01';
