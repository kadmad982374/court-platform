# Demo Deployment Guide
## نظام إدارة قضايا الدولة السورية — State Litigation Management System

This guide covers deploying the demo on any Linux/Mac server (or Windows with Docker Desktop) using Docker Compose.

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Docker | 24+ |
| Docker Compose | v2 (built-in with Docker 24) |
| Git | any recent |

No Java, Node, or PostgreSQL installation needed on the server — Docker handles everything.

---

## Step 1 — Clone the repository

```bash
git clone <your-github-repo-url> sla-demo
cd sla-demo
```

---

## Step 2 — Create the environment file

```bash
cp .env.demo.example .env.demo
```

Edit `.env.demo` and fill in:

```dotenv
DB_PASSWORD=choose_a_strong_password
SLA_JWT_SECRET=<base64 string, generate with: openssl rand -base64 32>
SLA_BOOTSTRAP_ADMIN_PASSWORD=ChangeMe!2026
DEMO_PORT=80
```

> **Note:** `SLA_JWT_SECRET` must be at least 32 bytes when decoded.  
> Generate: `openssl rand -base64 32`

---

## Step 3 — Build and start

```bash
# Linux / Mac
bash scripts/demo-up.sh

# Windows (PowerShell)
$env:DOCKER_BUILDKIT=0; docker compose -p sla-demo -f docker-compose.demo.yml --env-file .env.demo up -d --build

# Windows (CMD)
scripts\demo-up.bat

# Or directly (Linux/Mac)
DOCKER_BUILDKIT=0 docker compose -p sla-demo -f docker-compose.demo.yml --env-file .env.demo up -d --build
```

> **Note:** The `-p sla-demo` flag sets an explicit project name.  
> `DOCKER_BUILDKIT=0` is required when the project folder path contains non-ASCII characters (e.g. Arabic directory name). On a Linux server with an ASCII path this flag is not needed but does not hurt.

---

## Step 4 — Verify

```bash
# All three services should show "Up"
docker compose -f docker-compose.demo.yml ps

# Backend reachable (springdoc API docs endpoint)
curl http://localhost/api/v3/api-docs
# Expected: JSON response with API description

# Or just open the browser
http://<your-server-ip-or-domain>
```

---

## Step 5 — Log in

Open the app in a browser. Use any of the demo credentials below.

---

## Demo Credentials

All passwords: **`ChangeMe!2026`**

| Username | Role | Purpose |
|----------|------|---------|
| `admin` | CENTRAL_SUPERVISOR | Full system access, user management |
| `head_dam` | BRANCH_HEAD | Branch-level scope |
| `section_fi_dam` | SECTION_HEAD | Create/edit/promote cases, assign lawyer |
| `clerk_fi_dam` | ADMIN_CLERK (full) | All clerk actions including assign-lawyer |
| `clerk2_fi_dam` | ADMIN_CLERK (no assign) | Demonstrates permission hiding |
| `lawyer_fi_dam` | STATE_LAWYER | Hearings, finalizations, attachments |
| `lawyer2_fi_dam` | STATE_LAWYER | Alternative lawyer (dropdown) |
| `lawyer_inactive_fi` | STATE_LAWYER (inactive) | Demonstrates activeOnly filter |
| `lawyer_app_dam` | STATE_LAWYER (APPEAL dept) | Demonstrates department filter |
| `viewer` | READ_ONLY_SUPERVISOR | Read-only across all cases |

> These accounts are created by Flyway seed migrations (V20, V21).  
> They exist **only for demo purposes** and must be removed before production.

---

## Demo Cases (pre-seeded by V22)

| Case Number | Status | Demo Scenario |
|-------------|--------|--------------|
| DEMO-FRESH-001 | NEW | Assign → hearing → finalize |
| DEMO-ASSIGNED-002 | ACTIVE | Hearing progression + finalization record |
| DEMO-FINAL-003 | ACTIVE/FINALIZED | Appeal flow |
| DEMO-EXEC-004 | IN_EXECUTION | Execution file + steps |

---

## Managing the stack

### Stop (keep data)
```bash
bash scripts/demo-down.sh
# or
docker compose -f docker-compose.demo.yml down
```

### Stop and destroy all data
```bash
docker compose -f docker-compose.demo.yml down -v
```

### Update after a code push
```bash
bash scripts/demo-update.sh
# or
git pull && docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
```

### Restart a single service
```bash
docker compose -f docker-compose.demo.yml restart backend
```

---

## Logs

```bash
# All services
docker compose -f docker-compose.demo.yml logs -f

# Backend only
docker compose -f docker-compose.demo.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.demo.yml logs --tail=100 backend
```

---

## Attachment storage

Uploaded files are stored inside a named Docker volume: **`sla-demo-attachments`**

This maps to `/app/attachments-data` inside the backend container.

> ⚠️ This is demo-only local filesystem storage.  
> It is NOT backed up automatically.  
> For production, replace with object storage (S3/MinIO) — see `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md`.

To inspect the volume on the host:
```bash
docker volume inspect sla-demo-attachments
```

---

## Domain / Reverse Proxy (optional)

If running behind a domain with HTTPS (recommended for any real client demo):

1. Point your domain DNS A-record to the server IP.
2. Install Nginx or Caddy on the host as a reverse proxy.
3. Terminate TLS at the host proxy, forward port 80 → `DEMO_PORT`.
4. Change `DEMO_PORT` in `.env.demo` to an internal port (e.g. 8088) and proxy from 443 → 8088.

Simple Caddy example (`/etc/caddy/Caddyfile`):
```
demo.example.com {
    reverse_proxy localhost:8088
}
```

---

## Architecture overview

```
Browser
  │
  ▼
[Nginx :80]  ← serves built React SPA
  │
  ├── /api/*  ──proxy──►  [Spring Boot :8080]
  │                              │
  │                         [PostgreSQL :5432]
  │                              │
  │                        (Flyway V1–V22 auto-applied on startup)
  │
  └── /*      ──►  index.html  (React Router handles routing)
```

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| Backend keeps restarting | Check `docker compose logs backend` — usually DB not ready yet; wait for healthcheck |
| `DB_PASSWORD is required` error | `.env.demo` not found or not passed with `--env-file` |
| Port 80 already in use | Set `DEMO_PORT=8080` in `.env.demo` |
| Slow first build | Normal — Maven downloads dependencies (~2–3 min) |
| OTP code for password reset | Check backend logs: `docker compose logs backend \| grep OTP` |



