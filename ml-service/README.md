# ml-service/

Python microservice wrapping the trained composite air-quality status
classifier (BiGRU) used by the "Prediksi" feature.

Runs locally alongside `backend/`, called only by `backend/src/services/ml.js`
- never by the mobile app directly, same "sub-projects never talk to
each other directly" rule as the rest of the monorepo (`CLAUDE.md`). On
a raw VPS this binds to `127.0.0.1` and is never reachable from the
internet at all. On shared cPanel hosting there is no loopback-only
option (see `deploy/cpanel-README.md`) - set `ML_SERVICE_SHARED_SECRET`
there so `/predict` isn't open to anyone who finds the public
Application URL; leave it unset for local dev / a raw VPS.

## Setup

```sh
cd ml-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn app:app --reload --port 8001
```

Deploying to shared cPanel hosting instead of a raw VPS ("Setup Python
App") uses `passenger_wsgi.py` as the entry point instead of the
`uvicorn` command above - see `deploy/cpanel-README.md`.

`GET /health` returns `{"status": "ok"}`. `POST /predict` takes a window
of readings and returns the predicted composite status:

```json
// request
{ "readings": [ { "pm2_5": 2.4, "pm10": 2.8, "tvoc": 660, "no2": 33.4,
                   "co2": 520, "sound": 51.6, "illuminance_lux_matched": 500,
                   "humidity": 45.3, "temperature": 21.6 }, /* x60, oldest first */ ] }

// response
{ "label": "Rawan", "class_index": 1,
  "probabilities": { "Baik": 0.0002, "Rawan": 0.9998, "Peringatan": 0.0001, "Bahaya": 0.0 },
  "model_version": "bigru_model_20260911_164510" }
```

## Model architecture (confirmed by reconstructing + test-running it)

`Sequential`: `Input(60, 9)` -> `Bidirectional(GRU(48), return_sequences=True)`
-> `Dropout(0.3)` -> `Bidirectional(GRU(24))` -> `BatchNormalization`
-> `Dense(24, relu)` -> `Dropout(0.2)` -> `Dense(4, softmax)`.
L2-regularized GRU kernels (0.001). ~108k params. Confirmed end-to-end
with a real forward pass through the reconstructed model - see `app.py`.

**Files (both required, must be from the same training run - a
scaler's fitted stats only make sense for the model trained on that same
data):**
- `bigru_model_20260911_164510.pkl` - saved as a plain dict
  `{"architecture": <Keras Sequential to_json() string>, "weights": [...]}`,
  **not** via `keras.models.save()`/`load_model()`. `app.py` reconstructs
  it with `model_from_json()` + `set_weights()`. If you retrain, either
  overwrite this exact filename or update `MODEL_PATH` in `app.py`.
  Retrained 2026-09-11 (was `bigru_model_20260825_170626.pkl`); same
  architecture, same `metadata.json` (feature_cols/window/label_map
  unchanged) - only the learned weights and scaler stats changed.
- `scaler_20260911_164510.pkl` - an `sklearn.preprocessing.StandardScaler`
  fitted on the 9 `feature_cols`, saved with `joblib.dump` (not plain
  `pickle.dump` - loading it with bare `pickle.load` fails with
  `invalid load key`). Loads cleanly with **scikit-learn 1.6.1** (no
  `InconsistentVersionWarning`) - `requirements.txt` stays pinned to
  that.
- `metadata.json` - `feature_cols` / `window` / `label_map`, the single
  source of truth for input order and output label names.

## Known placeholders / open questions (real, unresolved)

- **NO2 scale mismatch - STILL UNRESOLVED after the 2026-09-11 retrain.**
  The scaler's fitted `no2` mean is **33.4** (std 14.05) - confirmed
  unchanged in the new `scaler_20260911_164510.pkl` (mean 33.40, std
  14.05, essentially identical to the old one), meaning the retrain used
  training data with `no2` in the same unit as before. `architecture.md`
  section 2.3's example MQTT payload has `"no2": 0.02`, `schema.md`
  documents the unit as **ppm**, and a real live reading pulled
  2026-09-12 was `no2: 0.149666` - both ~200-1600x smaller than the
  scaler's expected mean. Every other feature's mean is the same order
  of magnitude as real sensor values; only `no2` is wildly off. This
  strongly suggests the training data's `no2` column was in a different
  unit than what the live MiCS-4514 sensor reports in ppm (maybe ppb, or
  a raw/uncalibrated sensor value) - feeding real ppm-scale readings
  into this scaler as-is produces a heavily out-of-distribution scaled
  value for that one feature on every single prediction. **Needs the
  training script/data source checked** to confirm what unit `no2` was
  during training (and retraining with `no2` converted to real ppm, or
  the live sensor's raw units matched to whatever training used) before
  trusting live NO2-influenced predictions. See [[mics4514-no2-calibration]]
  for the sensor-side calibration work already done (R0/formula fix,
  confirmed live `no2` readings like 0.13-0.15 ppm are themselves
  correct) - this is a separate, still-open training-data-side problem.
- **`humidity` gap resolved.** `firmware/src/sensors/sht31.{h,cpp}` reads
  both temperature and humidity, `mqtt_pub.cpp` publishes both, and
  `schema.md` 3.3 / `backend/src/validate.js` / `backend/src/services/db.js`
  all store it. All 9 `feature_cols` now have a real path from sensor to
  DB row - the current gap is hardware, not software: the CO2, lux,
  temperature, and humidity sensors are not physically installed on the
  device as of this writing (undergoing repair), so live rows have `NULL`
  in those columns until reinstalled. `backend/src/services/ml.js`'s
  `buildWindowPayload()` fails safe on this (skips calling `/predict`
  rather than feeding nulls into the scaler) - see its comment.
- **Feature order trust**: `build_input()` in `app.py` trusts
  `metadata.json`'s `feature_cols` order to match what the scaler was
  fitted on - the scaler object itself has no `feature_names_in_` (it
  wasn't fit on a named DataFrame), so this can't be independently
  verified from the pickle alone. Low risk since it's explicitly
  labeled in the metadata, but worth confirming against the training
  script if one becomes available.
- **Feature name mapping** from the backend's DB column names to this
  service's `feature_cols` (`pm25`->`pm2_5`, `noise_db`->`sound`,
  `lux`->`illuminance_lux_matched`) belongs in the backend caller, not
  here - not implemented yet. The meaning of the `_matched` suffix on
  `illuminance_lux_matched` (a training-time interpolation/join step?)
  is also still unconfirmed.
- **The window's time step interval is unconfirmed** - unknown whether
  the 60 steps correspond to firmware's ~5s publish interval or some
  resampled interval. Matters for how the backend gathers the "last 60
  readings" (raw rows vs resampled).
- **No auth on `/predict`/`/health`** - acceptable while this is
  localhost-only, revisit if this service ever needs to be reachable
  from another machine.
- **Backend integration done.** `backend/src/services/mqtt.js` gathers the
  last `window` (60) `sensor_readings` rows after storing a new one and
  calls `POST /predict` via `backend/src/services/ml.js` - alongside the
  existing `evaluateThresholds()` call, not replacing it. Predictions are
  persisted in the `predictions` table (`schema.md` 3.7) and exposed at
  `GET /api/rooms/:deviceId/prediction` + broadcast over `/ws` as
  `{ type: "prediction", prediction }`. See the humidity/hardware note
  above for why this may not produce output yet on the real device.

## Files

- `app.py` - FastAPI app. `POST /predict`, `GET /health`. Loads
  model/scaler/metadata once at startup (fails fast if any are missing
  or broken, visible in `journalctl -u udara-ml-service` once deployed).
- `metadata.json`, `bigru_model_20260825_170626.pkl`,
  `scaler_20260825_170626.pkl` - see "Model architecture" above.
