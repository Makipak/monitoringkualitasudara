# deploy/cpanel-README.md

Deployment walkthrough for **shared cPanel hosting** (confirmed: cPanel
136, "Setup Node.js App" with Node up to 22.23.2, "Setup Python App"
with Python up to 3.13.15, Terminal access but **no root** - a shared
account, not a dedicated VPS). This supersedes `deploy/README.md` for
this project's actual hosting - that file assumed a raw VPS with root
(`apt-get`, `systemctl`, `ufw`), none of which are available here. Keep
`deploy/README.md` around only in case a real VPS is used later.

Both `backend/` and `ml-service/` run as separate cPanel "Application"
entries (Node.js App / Python App), each backed by Phusion Passenger,
which cPanel uses instead of systemd - Passenger supervises the process
(restarts it, starts it on boot) so there is no unit file to write.

## 0. Before installing anything: check your account's own limits

The cPanel "Server Information" panel shows server-wide stats (shared
with every other account on that box) - not your account's own quota.
Check separately, since `tensorflow-cpu` (ml-service's biggest
dependency) is a few hundred MB once installed into a venv, and `/home`
on the shared server was already reported at 83% used:

- cPanel home page or **Metrics -> Disk Usage**: your account's actual
  disk quota and how much is free.
- **Metrics -> Resource Usage** (if present): your account's own
  CPU/memory/entry-process limits (CloudLinux LVE) - these, not the
  server-wide 30-CPU/28%-memory numbers, are what ml-service actually
  has to run inside.

If disk headroom looks tight, say so before step 5 (ml-service) - worth
confirming rather than letting a `pip install` fail partway through.

## 1. Get the code onto the server

Via Terminal (Software -> the account has shell access, confirmed
earlier):

```sh
git clone <your-repo-url> ~/udara
cd ~/udara
```

(`git` is available to normal users on cPanel systems, no root needed.)
Note the absolute path - you'll need it as "Application root" (relative
to the account home) in both Setup-App wizards below, e.g. `udara/backend`
and `udara/ml-service`.

This brings over everything **except** what's gitignored - notably
`ml-service/*.pkl` (the trained model + scaler) and both `.env` files.
Those need separate, manual steps (3 and 5 below).

## 2. Backend - Setup Node.js App

Software -> **Setup Node.js App** -> Create Application:

- **Node.js version:** `22.23.2` (backend/package.json requires >=22.11.0)
- **Application mode:** Production
- **Application root:** `udara/backend`
- **Application URL:** whichever domain/subdomain the mobile app should
  hit, e.g. `api.yourdomain.com` (create the subdomain first in
  Domains -> Subdomains if it doesn't exist yet - cPanel adds the DNS
  record automatically, no external DNS step needed)
- **Application startup file:** `src/index.js`

After creating it, the interface gives you a command to "Enter to the
virtual environment" - run that in Terminal, then inside it:

```sh
npm install --omit=dev
```

(or use the "Run NPM Install" button in the app's page, equivalent.)

**Environment variables:** use the app's own "Environment Variables"
section in the cPanel UI (not a `.env` file) - add each var from
`backend/.env.example` as a real KEY=VALUE pair: `MQTT_HOST`,
`MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `DATABASE_URL`,
`JWT_SECRET`, `JWT_EXPIRES_IN`, `APP_ACCESS_KEY`, optionally
`FIREBASE_SERVICE_ACCOUNT_BASE64`, and (see step 4)
`ML_SERVICE_SHARED_SECRET`. `config.js` loads `dotenv/config`, but
dotenv never overrides a variable that's already set in the process
environment - so these UI-set vars are used as-is and no `.env` file is
needed at all on this hosting.

**Do not set `PORT`** - cPanel/Passenger assigns its own and injects it;
`config.js` already reads `process.env.PORT` (defaults to 3000 only if
unset), so this works automatically. Don't hardcode 3000.

Click **Start App**. Check the app's log file (shown in its cPanel page)
for `[server] listening on port ...` to confirm it came up; if MQTT/DB
creds are wrong you'll see that here too.

## 3. Backend redeploys later

```sh
cd ~/udara && git pull
```

then click **Restart** on the app's cPanel page (re-running `npm install`
first, from inside the app's virtual env, if `package.json` changed).

## 4. ml-service - Setup Python App

**Read this before creating the app:** cPanel's Python App has no
loopback-only mode - every app gets a public Application URL, unlike a
raw VPS where ml-service binds to `127.0.0.1` and is simply unreachable
from outside. To compensate, `ml-service/app.py` now enforces an
optional shared-secret header (`X-ML-Service-Token`) on `/predict` when
`ML_SERVICE_SHARED_SECRET` is set - **set it here**, and set the exact
same value as `ML_SERVICE_SHARED_SECRET` in the backend app's
environment variables (step 2). Generate a long random value, e.g.:

```sh
openssl rand -hex 32
```

Software -> **Setup Python App** -> Create Application:

- **Python version:** `3.11.16` or `3.12.14` (ml-service requires 3.11+;
  avoid 3.13.x until confirming `tensorflow-cpu>=2.21` publishes wheels
  for it)
- **Application root:** `udara/ml-service`
- **Application URL:** a subdomain nothing else links to, e.g.
  `ml.yourdomain.com` - the shared secret is the real protection, this
  is just to avoid an obvious guessable path
- **Application startup file:** `passenger_wsgi.py`
- **Application Entry point:** `application`

After creating it, enter the virtual environment command it gives you,
then:

```sh
pip install -r requirements.txt
```

Watch disk usage during this install (step 0) - `tensorflow-cpu` is the
large one. If it fails partway with a disk-space error, that confirms
the quota concern; report back before retrying.

**Environment variables:** add `ML_SERVICE_SHARED_SECRET` (the same
value used in step 2) via the app's Environment Variables section.

## 5. Upload the model files

`ml-service/*.pkl` are gitignored and did not come over with `git
clone`. They're tiny (current pair is ~156 KB total), so just use File
Manager: navigate to `udara/ml-service/`, upload
`bigru_model_20260825_170626.pkl` and `scaler_20260825_170626.pkl` from
your machine (drag-and-drop or the Upload button). Confirm the
filenames match exactly what `ml-service/app.py`'s `MODEL_PATH` /
`SCALER_PATH` expect - they do by default for this pair.

Click **Start App** (or Restart, if it auto-started without the model
files and is now crash-looping on the missing-file check in
`app.py`'s `lifespan`).

## 6. Verify ml-service came up correctly

From Terminal:

```sh
curl -s https://ml.yourdomain.com/health
# expect: {"status":"ok"}

curl -s -o /dev/null -w '%{http_code}\n' https://ml.yourdomain.com/predict \
  -X POST -H 'Content-Type: application/json' -d '{"readings":[]}'
# expect: 401 (missing/wrong token) if ML_SERVICE_SHARED_SECRET is set,
# or 400 (wrong reading count) if it's unset
```

**If `/health` 500s or the app's error log shows something like "no
module named passenger" / a WSGI environ-related traceback:** Passenger
on this account is too old to auto-detect FastAPI's ASGI `app` object.
Tell me and I'll add a WSGI adapter (`a2wsgi.ASGIMiddleware` wrapping
`app` in `passenger_wsgi.py`) as a fallback - not written speculatively
since it can't be verified without seeing the actual failure.

## 7. TLS

cPanel's AutoSSL (SSL/TLS Status in the sidebar) issues free Let's
Encrypt-backed certs automatically for domains on the account, including
new subdomains - usually no action needed beyond making sure AutoSSL is
enabled and giving it a few minutes after creating the subdomain. Use
`https://` (not `http://`) for both the backend's Application URL and
`ml.yourdomain.com` once issued.

## 8. Point the mobile app at the deployed backend

Update `mobile/src/config/env.ts`:

```ts
export const API_BASE_URL = 'https://api.yourdomain.com';
export const APP_ACCESS_KEY = '<same value set in backend env vars>';
```

Then build the release APK/AAB:

```sh
cd mobile/android
./gradlew assembleRelease   # or bundleRelease for a Play Store AAB
```

Android's default release-build network security policy blocks
cleartext HTTP (see the earlier discussion) - as long as `API_BASE_URL`
is `https://` (step 7 done), this is a non-issue and no
`usesCleartextTraffic` override is needed.

## Known unknowns - report back once tested

- Whether Passenger on this specific account auto-detects FastAPI as
  ASGI (step 6) - the most likely thing to actually break.
- Actual per-account disk/RAM/entry-process limits (step 0) - not yet
  confirmed, only server-wide numbers are known so far.
- Whether `tensorflow-cpu>=2.21` has a prebuilt wheel for whichever
  Python version you pick, on this server's architecture (`x86_64`,
  confirmed) - if `pip install` tries to build from source, that's slow
  and likely to hit resource limits; report the exact error if it does.
