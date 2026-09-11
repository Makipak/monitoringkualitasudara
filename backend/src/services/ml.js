// Pure request-building/calling logic for the ml-service composite-status
// classifier (BiGRU, see ml-service/README.md) - mirrors threshold.js in
// being a single-responsibility, side-effect-free module. Orchestration
// (fetching readings from the DB, persisting the result, broadcasting it,
// logging) stays in services/mqtt.js, same split as threshold.js/mqtt.js.
import {
  ML_SERVICE_URL,
  ML_PREDICTION_WINDOW_SIZE,
  ML_SERVICE_SHARED_SECRET,
} from "../config.js";

// DB column -> ml-service feature name (ml-service/metadata.json
// feature_cols). Only these three actually rename; the rest are 1:1.
const FEATURE_MAP = {
  pm25: "pm2_5",
  pm10: "pm10",
  tvoc: "tvoc",
  no2: "no2",
  co2: "co2",
  noise_db: "sound",
  lux: "illuminance_lux_matched",
  humidity: "humidity",
  temperature: "temperature",
};

const REQUIRED_DB_COLUMNS = Object.keys(FEATURE_MAP);

// Builds the ml-service /predict request body from `sensor_readings` rows
// (oldest first). Returns null - rather than sending a partial/zero-filled
// window - if there isn't exactly a full window of rows with every
// required feature present. This is what makes the pipeline fail safe
// while the CO2/lux/temperature/humidity sensors are physically
// uninstalled (see ml-service/README.md "Known placeholders"): those
// columns come back NULL from the DB until the hardware is reinstalled,
// so this check keeps failing (by design) and no prediction is ever
// computed from incomplete data - no code change is needed once the
// sensors are back, it just starts succeeding on its own.
export function buildWindowPayload(readings) {
  if (readings.length !== ML_PREDICTION_WINDOW_SIZE) return null;

  const mapped = [];
  for (const row of readings) {
    const features = {};
    for (const dbColumn of REQUIRED_DB_COLUMNS) {
      const value = row[dbColumn];
      if (value === null || value === undefined) return null;
      features[FEATURE_MAP[dbColumn]] = value;
    }
    mapped.push(features);
  }
  return mapped;
}

// Calls ml-service's POST /predict with an already-built window payload
// (from buildWindowPayload). Throws with a descriptive message on any
// non-2xx response or network failure - the caller (mqtt.js) is
// responsible for catching this so an ml-service outage never breaks the
// core sensor ingest pipeline.
export async function requestPrediction(mappedReadings) {
  const headers = { "Content-Type": "application/json" };
  // See config.js ML_SERVICE_SHARED_SECRET - only set on shared hosting
  // where ml-service ends up with a public URL; omitted entirely (rather
  // than sent empty) for a true localhost-only deployment.
  if (ML_SERVICE_SHARED_SECRET) {
    headers["X-ML-Service-Token"] = ML_SERVICE_SHARED_SECRET;
  }

  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: "POST",
    headers,
    body: JSON.stringify({ readings: mappedReadings }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ml-service /predict returned ${response.status}: ${body}`);
  }

  return response.json();
}
