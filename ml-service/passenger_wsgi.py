# Entry point for cPanel's "Setup Python App" (Phusion Passenger), used
# only on shared cPanel hosting - see deploy/cpanel-README.md. Not used
# for local dev or a raw VPS/systemd deployment (both run
# `uvicorn app:app` directly per ml-service/README.md).
#
# Passenger (since 6.0.6) detects an ASGI app automatically from the
# `application` callable's signature, same object FastAPI itself exposes
# for `app.py`'s `app = FastAPI(...)` - no WSGI shim needed as long as
# the cPanel account's Passenger version is new enough. If app creation
# in cPanel fails or /health 500s with an ASGI-related traceback in the
# app's error log, that version is too old and this needs a WSGI adapter
# (e.g. `a2wsgi.ASGIMiddleware`) instead - not written speculatively
# here since it can't be verified without testing against the real
# hosting account.
from app import app as application  # noqa: F401
