# نظام إدارة قضايا الدولة السورية
## State Litigation Management System

نظام مؤسسي هرمي لإدارة قضايا الدولة السورية — يُؤتمت دورة حياة الدعاوى من القيد الأول حتى انتهاء التنفيذ.

> **Status:** Demo-ready ✅ | Production: requires hardening (see [FINAL_PRODUCTION_BLOCKERS.md](docs/project/FINAL_PRODUCTION_BLOCKERS.md))

---

## Quick Start — Demo Server (Docker)

```bash
git clone <repo-url> sla-demo && cd sla-demo
cp .env.demo.example .env.demo
# Edit .env.demo: set DB_PASSWORD and SLA_JWT_SECRET
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
# Open http://localhost
```

Login with: `section_fi_dam` / `ChangeMe!2026`  
Full credentials list → [DEMO_DEPLOYMENT_GUIDE.md](docs/deployment/DEMO_DEPLOYMENT_GUIDE.md)

---

## Quick Start — Local Development (no Docker)

**Backend** (Java 21 + Maven 3.9 + PostgreSQL 14+):
```bash
cd backend
export DB_URL=jdbc:postgresql://localhost:5432/sla_dev
export DB_USER=postgres
export DB_PASSWORD=postgres
export SLA_JWT_SECRET=$(openssl rand -base64 32)
mvn clean package -DskipTests
java -jar target/state-litigation-backend-0.1.0-SNAPSHOT.jar
```

**Frontend** (Node 20+):
```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

---

## Repository Structure

```
backend/                  Java 21 + Spring Boot 3.3 + Maven + PostgreSQL/Flyway
  src/                    Application source
  Dockerfile              Multi-stage build (Maven → JRE)
  .env.example            Backend env variable template

frontend/                 React 18 + TypeScript + Vite + Tailwind CSS
  src/                    Application source
  nginx/nginx.conf        Nginx config for demo deployment
  Dockerfile              Multi-stage build (Node → Nginx)
  .env.example            Frontend env variable template

docker-compose.demo.yml   Full demo stack: DB + backend + frontend/Nginx
.env.demo.example         Demo environment variable template

scripts/
  demo-up.sh / .bat       Build and start demo stack
  demo-down.sh / .bat     Stop demo stack (keeps data)
  demo-update.sh / .bat   Pull + rebuild + restart

docs/
  deployment/
    DEMO_DEPLOYMENT_GUIDE.md     Step-by-step server deployment guide
    GITHUB_HANDOFF_GUIDE.md      For new developers cloning this repo
    DEMO_ENVIRONMENT_NOTES.md    Demo-only choices and known limitations
  project/
    PROJECT_PHASE_STATUS.md      Current backend+frontend phase status
    NEXT_CHAT_CONTEXT.md         Full context for next development session
    FINAL_PROJECT_CLOSURE_REPORT.md  What was built + architecture decisions
    FINAL_PRODUCTION_BLOCKERS.md     All known production blockers
    FINAL_PRODUCTION_READINESS_PLAN.md  Ordered plan to reach production
  project-ui/
    UI_PHASE_STATUS.md           Frontend phase status
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21, Spring Boot 3.3, Spring Security, JPA |
| Database | PostgreSQL 14+, Flyway (22 migrations) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Data fetching | TanStack Query v5, Axios |
| Forms | React Hook Form + Zod |
| Tests | Vitest (unit), Playwright (E2E — 78 passing) |
| Demo deployment | Docker Compose, Nginx |

---

## Demo Credentials

All passwords: **`ChangeMe!2026`**

| Username | Role |
|----------|------|
| `admin` | CENTRAL_SUPERVISOR |
| `section_fi_dam` | SECTION_HEAD |
| `lawyer_fi_dam` | STATE_LAWYER |
| `clerk_fi_dam` | ADMIN_CLERK (full) |
| `viewer` | READ_ONLY_SUPERVISOR |

Full list with demo scenarios → [DEMO_DEPLOYMENT_GUIDE.md](docs/deployment/DEMO_DEPLOYMENT_GUIDE.md)

---

## Key Documentation Links

| Document | Purpose |
|----------|---------|
| [DEMO_DEPLOYMENT_GUIDE.md](docs/deployment/DEMO_DEPLOYMENT_GUIDE.md) | How to deploy on a server |
| [GITHUB_HANDOFF_GUIDE.md](docs/deployment/GITHUB_HANDOFF_GUIDE.md) | Onboarding for new developers |
| [DEMO_ENVIRONMENT_NOTES.md](docs/deployment/DEMO_ENVIRONMENT_NOTES.md) | Demo limitations + safe expectations |
| [FINAL_PROJECT_CLOSURE_REPORT.md](docs/project/FINAL_PROJECT_CLOSURE_REPORT.md) | Full project closure report |
| [FINAL_PRODUCTION_BLOCKERS.md](docs/project/FINAL_PRODUCTION_BLOCKERS.md) | Production blockers (not started) |
| [FINAL_PRODUCTION_READINESS_PLAN.md](docs/project/FINAL_PRODUCTION_READINESS_PLAN.md) | Path to production |

---

## ⚠️ Important Notes

- This is a **demo build** — not production-hardened.
- JWT tokens are stored in `localStorage` (XSS risk).
- Attachment storage is local filesystem only.
- OTP for password reset is logged to console only (no SMS).
- Demo seed accounts with known passwords exist in the database.
- See [DEMO_ENVIRONMENT_NOTES.md](docs/deployment/DEMO_ENVIRONMENT_NOTES.md) for the full list.
