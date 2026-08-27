// Basic structural/range sanity check on incoming MQTT payloads
// (architecture.md section 7: "jangan langsung percaya data device tanpa
// validasi struktur/range dasar", to keep firmware bugs from writing
// corrupt rows into the database). This intentionally does NOT check
// against the `thresholds` table - that is normal-range evaluation
// (services/threshold.js), a separate concern from "is this even a
// well-formed number".
import { OFFICIAL_PARAMETERS } from "./config.js";

const NUMERIC_FIELDS = [...OFFICIAL_PARAMETERS, "temperature", "humidity"];

export function validateReadingPayload(raw) {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("payload is not a JSON object");
  }
  if (typeof raw.device_id !== "string" || raw.device_id.length === 0) {
    throw new Error("payload missing string device_id");
  }

  const reading = { device_id: raw.device_id };
  for (const field of NUMERIC_FIELDS) {
    if (raw[field] === undefined) continue; // firmware omits fields it failed to read this cycle
    const value = Number(raw[field]);
    if (!Number.isFinite(value)) {
      throw new Error(`field "${field}" is not a finite number: ${raw[field]}`);
    }
    reading[field] = value;
  }

  return reading;
}
