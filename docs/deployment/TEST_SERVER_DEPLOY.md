# Test Server Deploy — `test.kubetrust.com`

Deploy the State Litigation platform to the Hetzner test server (Ubuntu 22.04) using prebuilt images pulled from Docker Hub. **No source code, Maven, or npm needed on the server.**

## Server baseline (already done by Terraform + cloud-init)

The Hetzner `temp-infra` Terraform stack provisions:

- Ubuntu 22.04 on Hetzner `cx23` / nbg1
- Docker Engine + buildx + compose-plugin
- **nginx** running as a systemd service (listens on :80)
- ufw allowing 22/80/443
- fail2ban + unattended-upgrades
- SSH via ED25519 keys for `fadi` + `ahmad` (NOPASSWD sudo)

## Fast path — use the bootstrap script

From your laptop, copy the three files onto the server:

```bash
scp docker-compose.test.yml scripts/setup-test-server.sh user@test.kubetrust.com:~/
```

(The script will generate `.env.test` on first run — don't copy a local one unless you want to reuse its secrets.)

SSH in and run:

```bash
ssh user@test.kubetrust.com
bash setup-test-server.sh --email you@example.com
```

The script is idempotent — safe to re-run. It will:
1. Install `certbot` + nginx plugin (once)
2. Generate `.env.test` with strong random `DB_PASSWORD` + `SLA_JWT_SECRET` (only on first run; never overwritten)
3. Create a compose override pinning the frontend container to `127.0.0.1:8080` (so host nginx is the only public-facing surface)
4. `docker compose pull` and `up -d`
5. Wait for the backend healthcheck
6. Write `/etc/nginx/sites-available/test.kubetrust.com` as a reverse proxy → `localhost:8080`
7. Provision a Let's Encrypt TLS cert via `certbot --nginx` (enables auto-renewal timer)
8. Verify `https://test.kubetrust.com/` returns 200 and `/api/v3/api-docs` is reachable
9. Print login credentials + useful commands

Script flags:
- `--email you@example.com` — pass up front to skip the interactive prompt
- `--staging` — use Let's Encrypt staging (untrusted cert, for testing the flow without hitting rate limits)
- `--help` — prints the full header block

At the end of a successful run you'll see:

```
✓ Setup complete.
  URL   : https://test.kubetrust.com/
  Login : admin / ChangeMe!2026
```

## Manual steps (only if the script is unavailable or you want to inspect each stage)

## Verify

```bash
# Frontend
curl -I http://localhost/              # → 200 OK
curl    http://localhost/nginx-health  # → ok

# Backend (via same-origin proxy — backend is NOT exposed directly)
curl http://localhost/api/v3/api-docs | head -c 200
```

From the outside, once DNS resolves: `http://test.kubetrust.com/`

## First login

- Username: `admin`
- Password: whatever you set in `SLA_BOOTSTRAP_ADMIN_PASSWORD` (default `ChangeMe!2026`)

**Change the admin password immediately after first login.**

## TLS (recommended for anything other than throwaway testing)

The compose does NOT terminate TLS. Put Caddy in front:

```caddy
# /etc/caddy/Caddyfile
test.kubetrust.com {
    reverse_proxy localhost:80
}
```

Caddy auto-provisions Let's Encrypt certs. Make sure port 80 isn't also bound by the frontend container if Caddy needs it — easiest fix: change `TEST_PORT=8080` in `.env.test` and point Caddy at `localhost:8080`.

## Upgrading to a newer image tag

```bash
# Edit docker-compose.test.yml → change :01 to the new tag (e.g. :02)
# Then:
docker compose -f docker-compose.test.yml --env-file .env.test pull
docker compose -f docker-compose.test.yml --env-file .env.test up -d
docker image prune -f      # remove the old :01 image once confirmed working
```

## Stop / restart / clean

```bash
# Stop (keeps DB + attachments volumes)
docker compose -f docker-compose.test.yml --env-file .env.test down

# Nuke everything including DB + attachments (destructive!)
docker compose -f docker-compose.test.yml --env-file .env.test down -v
```

## Troubleshooting

| Symptom | Check |
|---|---|
| Backend keeps restarting | `docker compose logs backend` — usually missing `SLA_JWT_SECRET` or wrong base64 format |
| `502 Bad Gateway` from frontend | Backend not yet healthy — wait 90 s and retry; check `docker compose ps` status |
| Flyway migration failure | Fresh volume only — `docker compose down -v` then `up -d` again |
| Arabic shows as `???` | nginx `charset utf-8` is set in the image; check your reverse proxy isn't stripping the `Content-Type` header |

## Images used

- `fadidasus/court-platform-backend:02` — adds `[ACTION] / [DENIED] / [SYSTEM] / [FAILED]` user-activity logs
- `fadidasus/court-platform-frontend:02` — unchanged from :01 (retagged)
- `postgres:16-alpine` (official)

## Watching user activity during a test session

The backend emits one clear line per user action. To follow along live:

```bash
# Just the action stream (recommended during tests):
docker compose -f docker-compose.test.yml --env-file .env.test logs -f backend | grep -E '\[ACTION\]|\[DENIED\]|\[FAILED\]|\[SYSTEM\]'

# Or everything:
docker compose -f docker-compose.test.yml --env-file .env.test logs -f backend
```

Example lines you will see as a user clicks through the app:

```
[ACTION] User 'section_fi_dam' (SECTION_HEAD) signed in
[ACTION] User 'section_fi_dam' (SECTION_HEAD) created case #42 — court=5, basis=123/2026, owner=7
[ACTION] User 'section_fi_dam' (SECTION_HEAD) assigned lawyer (user #7) to case #42
[ACTION] User 'lawyer_fi_dam' (STATE_LAWYER) signed in
[ACTION] User 'lawyer_fi_dam' (STATE_LAWYER) rolled over hearing on stage #11 of case #42 — next date=2026-05-01, reason=NOTIFY_PARTIES_PERSONAL
[ACTION] User 'lawyer_fi_dam' (STATE_LAWYER) uploaded attachment #3 (245678 bytes) to scope=CASE_STAGE scopeId=11
[DENIED] User 'lawyer_other' (STATE_LAWYER) tried to read case #42 — reason=not the assigned lawyer
[SYSTEM] Anonymous — login failed — reason=INVALID_CREDENTIALS, username=admin
```

Each log line also carries `[user=<username>]` in the header (from MDC) so even framework logs show who triggered them.

The two custom images are **public** on Docker Hub at the moment. Plan to move to a private repo (or tag `:latest` only after QA) for anything beyond throwaway testing.
