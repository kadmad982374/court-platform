# GitHub Handoff Guide
## State Litigation Management System

This guide is for any developer or operator who receives this repository.

---

## What is included in this repo

| Path | Contents |
|------|---------|
| `backend/` | Java 21 + Spring Boot 3.3 + Maven + PostgreSQL/Flyway |
| `frontend/` | React 18 + TypeScript + Vite + Tailwind CSS |
| `docker-compose.demo.yml` | Complete demo deployment (DB + backend + frontend) |
| `backend/Dockerfile` | Multi-stage Maven → JRE build |
| `frontend/Dockerfile` | Multi-stage Node → Nginx build |
| `frontend/nginx/nginx.conf` | Nginx config: serves SPA + proxies /api |
| `.env.demo.example` | Template for demo environment variables |
| `backend/.env.example` | Template for backend-only local dev |
| `frontend/.env.example` | Template for frontend-only local dev |
| `scripts/` | demo-up / demo-down / demo-update (sh + bat) |
| `docs/deployment/` | Deployment and handoff guides |
| `docs/project/` | Full project architecture, phase status, closure report |
| `docs/project-ui/` | Full UI phase status and Playwright coverage report |

---

## What is intentionally NOT production-ready

This is a **demo system only**. The following are known gaps documented in  
`docs/project/FINAL_PRODUCTION_BLOCKERS.md`:

| Gap | Impact |
|-----|--------|
| JWT stored in `localStorage` | XSS risk — needs httpOnly cookies for production |
| Local filesystem attachment storage | No redundancy — needs S3/MinIO |
| No SMS provider (OTP via console logs) | Password reset is dev-only in this build |
| No rate limiting | Brute force possible |
| BootstrapAdminRunner enabled | Auto-creates admin on startup — disable in production |
| V20 dev seed users | Test accounts with known passwords — remove before production |
| No backup/DR | Data loss risk |
| No HTTPS in demo compose | Add host-level reverse proxy for TLS |
| No secrets management | Secrets in env file — use Vault/KMS for production |

---

## How another developer can clone and run it

### Option A — Full demo with Docker (recommended)

```bash
git clone <repo-url> sla-demo && cd sla-demo
cp .env.demo.example .env.demo
# Edit .env.demo: set DB_PASSWORD and SLA_JWT_SECRET
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
# Open http://localhost
```

See: `docs/deployment/DEMO_DEPLOYMENT_GUIDE.md`

### Option B — Local development (no Docker)

Requirements: Java 21, Maven 3.9, Node 20, PostgreSQL 14+

**Backend:**
```bash
cd backend
# Set env vars (or export them):
export DB_URL=jdbc:postgresql://localhost:5432/sla_dev
export DB_USER=postgres
export DB_PASSWORD=postgres
export SLA_JWT_SECRET=$(openssl rand -base64 32)
mvn clean package -DskipTests
java -jar target/state-litigation-backend-0.1.0-SNAPSHOT.jar
```

Flyway migrations (V1–V22) run automatically on first startup.

**Frontend:**
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:8080`.

---

## Main entry-point documents

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview and quick start |
| `docs/deployment/DEMO_DEPLOYMENT_GUIDE.md` | Step-by-step demo server deployment |
| `docs/deployment/DEMO_ENVIRONMENT_NOTES.md` | Demo-only choices and known limitations |
| `docs/project/FINAL_PROJECT_CLOSURE_REPORT.md` | What was built, what remains |
| `docs/project/FINAL_PRODUCTION_BLOCKERS.md` | All known production blockers |
| `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md` | Ordered plan to reach production |
| `docs/project/PROJECT_PHASE_STATUS.md` | Current phase status |
| `docs/project-ui/UI_PHASE_STATUS.md` | Frontend phase status |

---

## Tech stack summary

| Layer | Technology |
|-------|-----------|
| Backend language | Java 21 |
| Backend framework | Spring Boot 3.3 + Spring Security |
| ORM / migrations | JPA + Flyway (22 migrations) |
| Database | PostgreSQL 14+ |
| Frontend language | TypeScript |
| Frontend framework | React 18 + React Router v6 |
| Data fetching | TanStack Query v5 + Axios |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS (RTL Arabic-first) |
| Build tool | Vite |
| E2E tests | Playwright (78 passing) |
| Unit tests | Vitest (22 passing) |
| Container | Docker + Docker Compose |
| Web server | Nginx (demo) |

---

## Seed data summary

- **V20:** 5 demo users (all password: `ChangeMe!2026`)
- **V21:** 4 additional lawyer/clerk users for assign-lawyer flow
- **V22:** 4 demo cases (NEW / ACTIVE / FINALIZED / IN_EXECUTION) + execution file + steps + reminders + notifications + attachment metadata
- **BootstrapAdminRunner:** Creates `admin / ChangeMe!2026` on first startup if not exists

