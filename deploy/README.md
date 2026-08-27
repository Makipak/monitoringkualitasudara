# deploy/

systemd unit files for running `backend/` and `ml-service/` as persistent
services on the VPS (see project decision: VPS hosting, superseding an
earlier "run locally" plan). Both services are colocated on one VPS;
`ml-service` binds to `127.0.0.1` only and is never reachable from
outside the machine - only `backend/` calls it, over localhost. The
mobile app only ever talks to `backend/`'s public port, matching the
monorepo's "sub-projects never talk to each other directly" rule
(`CLAUDE.md`).

Assumes Ubuntu (22.04/24.04) - adjust package manager commands if your
VPS runs something else.

## 1. One-time VPS setup

```sh
# Dedicated non-root user to run both services - do not run as root.
sudo useradd --system --create-home --shell /usr/sbin/nologin udara

# Node.js >= 22.11.0 (backend/package.json "engines") - Ubuntu's default
# apt package is usually too old, use NodeSource:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.11+ and venv support
sudo apt-get install -y python3 python3-venv git
```

## 2. Get the code onto the VPS

```sh
sudo -u udara git clone <your-repo-url> /opt/udara/monitoringkualitasudara
```

(Or `rsync`/`scp` it over, or `git pull` if it's already cloned - doesn't
matter how, as long as it ends up owned by the `udara` user at the path
above. If you use a different path, update `WorkingDirectory=` /
`ExecStart=` in both `.service` files to match before copying them in
step 4.)

## 3. Configure each service

**backend/**

```sh
cd /opt/udara/monitoringkualitasudara/backend
sudo -u udara npm install --omit=dev
sudo -u udara cp .env.example .env
sudo -u udara nano .env   # fill in real DATABASE_URL/MQTT/JWT_SECRET/APP_ACCESS_KEY
```

**ml-service/**

```sh
cd /opt/udara/monitoringkualitasudara/ml-service
sudo -u udara python3 -m venv .venv
sudo -u udara .venv/bin/pip install -r requirements.txt
# Drop the trained model.pkl into this folder before starting the
# service for real - see ml-service/README.md "Known placeholders",
# predict() still returns 501 until that's wired up.
```

## 4. Install and start the systemd services

```sh
sudo cp deploy/udara-backend.service deploy/udara-ml-service.service /etc/systemd/system/

# If you used a path other than /opt/udara/monitoringkualitasudara,
# edit the copies in /etc/systemd/system/ now (WorkingDirectory=/ExecStart=).

sudo systemctl daemon-reload
sudo systemctl enable --now udara-backend udara-ml-service

# Check both came up:
sudo systemctl status udara-backend udara-ml-service
```

## 5. Logs

```sh
journalctl -u udara-backend -f
journalctl -u udara-ml-service -f
```

## 6. Firewall

Only the backend's port needs to be reachable from outside (default
`3000`, or whatever `PORT` is set to in `backend/.env`), plus SSH.
`ml-service` binds to `127.0.0.1` so it's unreachable externally
regardless, but don't open its port (`8001`) in the firewall either -
defense in depth.

```sh
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp   # match backend/.env PORT
sudo ufw enable
```

## Known placeholders / not done yet

- **TLS is not set up here.** Once the mobile app reaches this backend
  over the public internet instead of a LAN, plain HTTP/WS is a real
  exposure (credentials in `/api/auth/token`, unauthenticated `/ws`
  broadcast per `backend/README.md`'s known placeholder). Putting Nginx
  or Caddy in front with a real TLS cert needs a domain name pointing at
  the VPS - tell me if/when you have one and I'll add that reverse-proxy
  config here.
- These unit files assume `backend/` and `ml-service/` are deployed from
  the same git checkout used for development - no CI/build pipeline
  exists yet (deploying is a manual `git pull` + restart for now):

  ```sh
  cd /opt/udara/monitoringkualitasudara && sudo -u udara git pull
  sudo systemctl restart udara-backend udara-ml-service
  ```
- `ProtectSystem=strict` + `ReadWritePaths=` in both unit files is a
  reasonable default hardening but hasn't been tested against whatever
  `npm install` / pip actually need at runtime - if a service fails to
  start with a permissions-looking error, check `journalctl` first
  before loosening these.
