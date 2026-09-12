# Entry point for cPanel's "Setup Python App" (Phusion Passenger), used
# only on shared cPanel hosting - see deploy/cpanel-README.md. Not used
# for local dev or a raw VPS/systemd deployment (both run
# `uvicorn app:app` directly per ml-service/README.md, which stays a
# normal FastAPI/ASGI app - untouched by anything below).
#
# Confirmed 2026-09-11 against the real hosting account (LiteSpeed +
# CloudLinux Passenger): both handing Passenger the FastAPI ASGI `app`
# object directly, and wrapping it with `a2wsgi.ASGIMiddleware`, failed
# here - plain ASGI 500'd every request immediately, a2wsgi hung every
# request (including /health, which touches none of the model-loading
# code) until LiteSpeed's own ~2 minute timeout. Root cause not
# reachable without server-side access we don't have on shared hosting.
#
# Fix: skip ASGI/WSGI bridging entirely. This is a small hand-written
# *plain WSGI* app (sync, stdlib-only) that calls app.py's already
# request-agnostic pure functions (get_metadata/get_model/get_scaler/
# build_input, and its Pydantic Reading/PredictRequest models for the
# same validation FastAPI would have done) directly - no FastAPI,
# Starlette, or asyncio involved, so there is nothing left for a broken
# ASGI bridge to break. Deliberately duplicates only routing/response
# glue, not business logic - if app.py's request/response shape changes,
# update the mapping below to match.
import json

from pydantic import ValidationError

from app import (
    MODEL_PATH,
    ML_SERVICE_SHARED_SECRET,
    PredictRequest,
    build_input,
    get_metadata,
    get_model,
    get_scaler,
)


def _json_response(start_response, status, body_dict):
    body = json.dumps(body_dict).encode("utf-8")
    start_response(
        status,
        [
            ("Content-Type", "application/json"),
            ("Content-Length", str(len(body))),
        ],
    )
    return [body]


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")

    if path == "/health" and method == "GET":
        return _json_response(start_response, "200 OK", {"status": "ok"})

    if path == "/predict" and method == "POST":
        # Same check as app.py's verify_shared_secret dependency.
        if ML_SERVICE_SHARED_SECRET:
            token = environ.get("HTTP_X_ML_SERVICE_TOKEN")
            if token != ML_SERVICE_SHARED_SECRET:
                return _json_response(
                    start_response,
                    "401 Unauthorized",
                    {"detail": "invalid or missing X-ML-Service-Token"},
                )

        try:
            length = int(environ.get("CONTENT_LENGTH") or 0)
            raw_body = environ["wsgi.input"].read(length) if length else b"{}"
            payload = json.loads(raw_body or b"{}")
        except (ValueError, TypeError):
            return _json_response(start_response, "400 Bad Request", {"detail": "invalid JSON body"})

        try:
            parsed = PredictRequest.model_validate(payload)
        except ValidationError as exc:
            return _json_response(start_response, "400 Bad Request", {"detail": exc.errors()})

        metadata = get_metadata()
        window = metadata["window"]
        if len(parsed.readings) != window:
            return _json_response(
                start_response,
                "400 Bad Request",
                {"detail": f"expected exactly {window} readings, got {len(parsed.readings)}"},
            )

        model = get_model()
        scaler = get_scaler()
        X = build_input(parsed.readings, metadata, scaler)
        probs = model.predict(X, verbose=0)[0]
        class_index = int(probs.argmax())
        label_map = metadata["label_map"]

        return _json_response(
            start_response,
            "200 OK",
            {
                "label": label_map[str(class_index)],
                "class_index": class_index,
                "probabilities": {label_map[str(i)]: float(p) for i, p in enumerate(probs)},
                "model_version": MODEL_PATH.stem,
            },
        )

    return _json_response(start_response, "404 Not Found", {"detail": "not found"})
