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
  "model_version": "bigru_model_20260913_171018" }
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
- `bigru_model_20260913_171018.pkl` - saved as a plain dict
  `{"architecture": <Keras Sequential to_json() string>, "weights": [...]}`,
  **not** via `keras.models.save()`/`load_model()`. `app.py` reconstructs
  it with `model_from_json()` + `set_weights()`. If you retrain, either
  overwrite this exact filename or update `MODEL_PATH` in `app.py`.
  **Deployed 2026-09-14 - deliberately, user-confirmed choice, despite
  NOT having the NO2 unit fix**: this run's scaler is byte-identical
  (confirmed via md5sum) to `scaler_20260911_164510.pkl` - same training
  data/preprocessing, still the unconverted µg/m3-scale `no2` (mean
  33.4, ~1600x real ppm values from the live sensor) - only the model's
  learned weights differ (a real distinct training run, not a
  duplicate). `bigru_model_20260913_232909.pkl` (same day, later run)
  DOES have the NO2 fix applied and confirmed correct (scaler `no2` mean
  0.0177, matching real ppm) - user's stated plan is to switch to that
  one "kalau ada perubahan" (once some further check/change happens);
  don't assume 171018 is the final choice, and don't be surprised if a
  future session finds MODEL_PATH pointed at 232909 instead. No
  standalone accuracy/F1 numbers exist for 171018 specifically (no
  companion `metadata_20260913_171018.pkl` was produced) -
  `metadata.json`'s `test_accuracy`/`macro_f1`/`weighted_f1` fields
  currently describe the 232909 run, not this deployed one; they're
  informational only (not read by `app.py` at request time), but don't
  cite them as this model's own metrics.
- `scaler_20260913_171018.pkl` - an `sklearn.preprocessing.StandardScaler`
  fitted on the 9 `feature_cols`, saved with `joblib.dump` (not plain
  `pickle.dump` - loading it with bare `pickle.load` fails with
  `invalid load key`). Loads cleanly with **scikit-learn 1.6.1** (no
  `InconsistentVersionWarning`) - `requirements.txt` stays pinned to
  that.
- `metadata.json` - `feature_cols` / `window` / `label_map`, the single
  source of truth for input order and output label names. Structurally
  still valid for 171018 (same 9 features/window/labels as every other
  retrain so far) - only its accuracy-stat fields belong to a different
  run, see above.

## Known placeholders / open questions (real, unresolved)

- **NO2 scale mismatch - fix EXISTS (in `bigru_model_20260913_232909.pkl`)
  but is NOT what's currently deployed.** `app.py` as of 2026-09-14 points
  at `bigru_model_20260913_171018.pkl` instead - a user-confirmed
  deliberate choice (see git history) - whose scaler still has the
  original bug: `no2` mean **33.4** (std 14.05), ~200-1600x larger than
  real live readings (`no2: ~0.15` ppm) and `architecture.md`'s example
  payload (`0.02`). **Root cause**, confirmed by inspecting the actual
  training notebook (`Falhore.ipynb`) and source CSVs (`laboratory.csv`,
  `one_room_apartement.csv`): both come from an air-Q Science device,
  which reports NO2 in **ug/m3**, not ppm - the raw column there
  averages ~33.4 ug/m3 (matching the buggy scaler's mean exactly), and
  33.4 / 1881.7 (the EPA/WHO ug/m3-to-ppm divisor for NO2 at 25C/1atm)
  is ~0.0178 ppm, lining up almost exactly with `architecture.md`'s
  example payload. **Fix applied to `Falhore.ipynb`**
  (`NO2_UGM3_TO_PPM_DIVISOR = 1881.7`, converts both `no2` itself and its
  label thresholds right after loading) and a same-day later retrain
  (`bigru_model_20260913_232909.pkl` / `scaler_20260913_232909.pkl`)
  confirms the fix took - that scaler's `no2` mean is **0.0178** (std
  0.0075). **This fixed pair is sitting in `ml-service/` right now,
  unused** - swap `MODEL_PATH`/`SCALER_PATH` in `app.py` to it (locally
  and on the deployed cPanel host) whenever the plan is to actually rely
  on NO2-influenced predictions being correct. **New caveat found on
  that fixed run, for whenever it IS deployed**: even correctly scaled,
  live NO2 (~0.15 ppm) is still *above* the training data's own max
  after conversion (~0.043-0.069 ppm) - so live NO2 would be a real (if
  much smaller) extrapolation beyond the training range, not a ~1000x
  unit-scale artifact. See the sensor-side calibration work (firmware
  `mics4514.cpp` - R0/formula fix, confirmed live `no2` readings like
  0.13-0.15 ppm are themselves correct) for the separate,
  already-resolved half of this story - that was the sensor, this is
  the training data.
- **`humidity` gap resolved, and the hardware gap is closed too.**
  `firmware/src/sensors/sht31.{h,cpp}` reads both temperature and
  humidity, `mqtt_pub.cpp` publishes both, and `schema.md` 3.3 /
  `backend/src/validate.js` / `backend/src/services/db.js` all store it.
  All 9 `feature_cols` now have a real path from sensor to DB row. The
  CO2, lux, temperature, and humidity sensors were physically
  uninstalled for a while (hardware repair) but are reinstalled and
  reporting again (reconfirmed 2026-09-13) - `backend/src/services/ml.js`'s
  `buildWindowPayload()` fail-safe gate (skip rather than feed nulls into
  the scaler) is what covered that gap and needed no code change once
  the sensors came back; it stays in place for any future sensor outage.
- **Training data has zero "Baik" (composite label 0) examples - confirmed
  2026-09-13, not yet fixed.** `Falhore.ipynb`'s label distribution is
  `Rawan 39234, Peringatan 21272, Bahaya 3126` - exactly the full 63,632
  rows, so the model never sees a single "Baik" ground-truth example and
  structurally can't predict it, no matter how clean live readings are.
  Root cause: `score_and_diagnose()` takes `max()` across all 9
  per-parameter sub-scores, and `Kebisingan` (noise) is above the 45dB
  "Baik" cutoff in 99.44% of rows in BOTH source CSVs (`laboratory.csv`
  mean 50.8dB, `one_room_apartement.csv` mean 55.1dB, min 48.7dB - never
  below 45) - dragging almost every row's overall label to at least
  Rawan regardless of the other 8 parameters. **Not a threshold bug**:
  the 45dB cutoff is correctly cited (Kepmenkes RI No. 1204/2004, same
  number `iaqIndex.js` uses) and matches this project's own real device,
  whose noise sensor reads 26-36dB in practice (user-confirmed) - the
  problem is that `laboratory.csv`/`one_room_apartement.csv` (third-party
  datasets, not recorded in a hospital-like quiet room) essentially never
  have low noise **and** the other 8 parameters good at the same time
  (only 116/63,632 rows even ignoring lux). User decision 2026-09-13:
  deferred - the concurrent NO2 fix above remains worth retraining for on
  its own, but this needs better/additional training data (not a
  threshold tweak) to actually resolve, and hasn't been addressed yet.
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
  here - implemented as `FEATURE_MAP` in `backend/src/services/ml.js`.
  The meaning of the `_matched` suffix on `illuminance_lux_matched` (a
  training-time interpolation/join step?) is still unconfirmed.
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
- `metadata.json`, `bigru_model_20260913_232909.pkl`,
  `scaler_20260913_232909.pkl` - see "Model architecture" above.
- `Falhore.ipynb` - the actual training notebook (Google Colab, paths
  under `/content/drive/MyDrive/PENELITIAN UDARA/...`): loads
  `laboratory.csv`/`one_room_apartement.csv`/`Library_Indoor_IoT_Dataset_1.csv`,
  builds the composite label, trains the BiGRU, and saves the
  model/scaler/metadata `.pkl` triplet consumed by `app.py`. Added to
  this repo 2026-09-13 (previously not present here at all - the NO2 fix
  above was only possible once this notebook and the raw CSVs were
  available to inspect). Not runnable outside Colab as-is (Drive paths).
- `laboratory.csv`, `one_room_apartement.csv`,
  `Library_Indoor_IoT_Dataset_1.csv` - the raw training datasets
  `Falhore.ipynb` reads (the first two from an air-Q Science device, see
  the NO2 note above; the third a public indoor-IoT dataset used only to
  donate `illuminance_lux` via nearest-neighbor matching). Currently
  untracked by git - large raw data files, consider whether these belong
  in the repo at all (vs. `*.pkl`'s existing gitignore treatment) before
  committing them.
