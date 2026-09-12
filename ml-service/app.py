# ML inference service for the Udara "Prediksi" feature - wraps the
# trained composite air-quality status classifier (BiGRU, see README for
# the confirmed architecture) for the "Prediksi" feature.
#
# Runs locally alongside backend/, and is only ever called by backend/'s
# services/ml.js - never by the mobile app directly. Same "sub-projects
# never talk directly" rule as the rest of the monorepo (CLAUDE.md). On a
# raw VPS this is over plain http://localhost:<port>/predict with no
# public exposure at all; on shared cPanel hosting (deploy/cpanel-
# README.md) "Setup Python App" always assigns a public Application URL,
# so ML_SERVICE_SHARED_SECRET (see above) stands in for that missing
# network-level isolation there.
#
# This service has one job: turn a window of raw sensor readings into a
# composite status label. It does not know about MQTT, the database, or
# rule-based threshold evaluation (backend/src/services/threshold.js) -
# those stay entirely on the Node side.

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from keras.models import model_from_json
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
METADATA_PATH = BASE_DIR / "metadata.json"

# Optional shared secret, checked against the `X-ML-Service-Token` header
# (see backend/src/config.js ML_SERVICE_SHARED_SECRET for the matching
# side). Unset by default - true on a raw VPS/systemd deployment where
# this service binds to 127.0.0.1 and is unreachable regardless. Shared
# cPanel hosting (deploy/cpanel-README.md) has no loopback-only option
# for a "Setup Python App" - it always gets a public Application URL -
# so set this env var there to keep /predict from being open to anyone
# who finds that URL.
ML_SERVICE_SHARED_SECRET = os.environ.get("ML_SERVICE_SHARED_SECRET")


def verify_shared_secret(x_ml_service_token: Optional[str] = Header(default=None)):
    if ML_SERVICE_SHARED_SECRET and x_ml_service_token != ML_SERVICE_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="invalid or missing X-ML-Service-Token")

# Filenames carry the training run's timestamp - this model file and
# this scaler file must always be from the SAME training run (the
# scaler's fitted mean_/scale_ only make sense for the data distribution
# that specific model was trained on). If you retrain, either overwrite
# both files keeping these exact names, or update both paths together -
# never mix a model from one run with a scaler from another.
MODEL_PATH = BASE_DIR / "bigru_model_20260911_164510.pkl"
SCALER_PATH = BASE_DIR / "scaler_20260911_164510.pkl"

_model = None
_scaler = None
_metadata: Optional[dict] = None


def get_metadata() -> dict:
    global _metadata
    if _metadata is None:
        if not METADATA_PATH.exists():
            raise FileNotFoundError(f"{METADATA_PATH} not found")
        _metadata = json.loads(METADATA_PATH.read_text())
    return _metadata


def get_model():
    # Saved as a plain dict {"architecture": <Keras to_json() string>,
    # "weights": [...]} rather than via keras' own model.save()/
    # load_model() - reconstruct it the same way it was built.
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"{MODEL_PATH} not found")
        data = joblib.load(MODEL_PATH)
        model = model_from_json(data["architecture"])
        model.set_weights(data["weights"])
        _model = model
    return _model


def get_scaler():
    # sklearn StandardScaler fitted on the 9 training features, in
    # metadata["feature_cols"] order (see build_input below). Saved with
    # joblib.dump, not plain pickle.dump - must load with joblib.load.
    global _scaler
    if _scaler is None:
        if not SCALER_PATH.exists():
            raise FileNotFoundError(f"{SCALER_PATH} not found")
        _scaler = joblib.load(SCALER_PATH)
    return _scaler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast at startup (visible in `journalctl -u udara-ml-service`)
    # if the model/scaler/metadata are missing or broken, rather than
    # only discovering it on the first /predict call.
    get_metadata()
    get_model()
    get_scaler()
    yield


app = FastAPI(title="Udara ML Service", version="0.1.0", lifespan=lifespan)


# One row = one timestep in the window. Field names match
# metadata.json's feature_cols - keep these in sync by hand, there's no
# single source of truth linking the two yet (see README).
class Reading(BaseModel):
    pm2_5: float
    pm10: float
    tvoc: float
    no2: float
    co2: float
    sound: float
    illuminance_lux_matched: float
    humidity: float
    temperature: float


class PredictRequest(BaseModel):
    # Must contain exactly metadata["window"] readings, oldest first.
    readings: list[Reading] = Field(
        ..., description="Window of consecutive sensor readings, oldest first"
    )


class PredictResponse(BaseModel):
    label: str
    class_index: int
    probabilities: dict[str, float]
    # Which trained model run produced this prediction (MODEL_PATH's
    # filename stem) - lets callers that persist predictions (backend/)
    # trace a stored row back to the exact model file, since filenames are
    # timestamped per training run and nothing else in the response
    # identifies the model version.
    model_version: str


def build_input(readings: list[Reading], metadata: dict, scaler) -> np.ndarray:
    feature_cols = metadata["feature_cols"]
    # Pull each feature by name (via metadata's feature_cols, not by
    # trusting Reading's declared field order) so this stays correct
    # even if the two drift apart later.
    raw = np.array(
        [[getattr(r, col) for col in feature_cols] for r in readings],
        dtype="float32",
    )  # (window, n_features)
    scaled = scaler.transform(raw)  # StandardScaler: (x - mean_) / scale_
    return scaled.reshape(1, len(readings), len(feature_cols)).astype("float32")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse, dependencies=[Depends(verify_shared_secret)])
def predict(payload: PredictRequest):
    metadata = get_metadata()
    window = metadata["window"]
    label_map = metadata["label_map"]

    if len(payload.readings) != window:
        raise HTTPException(
            status_code=400,
            detail=f"expected exactly {window} readings, got {len(payload.readings)}",
        )

    model = get_model()
    scaler = get_scaler()
    X = build_input(payload.readings, metadata, scaler)

    probs = model.predict(X, verbose=0)[0]
    class_index = int(np.argmax(probs))

    return PredictResponse(
        label=label_map[str(class_index)],
        class_index=class_index,
        probabilities={label_map[str(i)]: float(p) for i, p in enumerate(probs)},
        model_version=MODEL_PATH.stem,
    )
