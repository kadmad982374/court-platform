---
name: Court Platform Knowledge Base
description: Comprehensive technical reference for the Syrian State Litigation Management System (court-platform) — architecture, modules, stack, conventions, commands
type: project
originSessionId: c060185a-20fe-4d76-8cf3-be486d28a169
---
# Court Platform — Knowledge Base

**Repo:** `C:\Users\FAD\IdeaProjects\lawyer\court-platform`
**Name (Arabic):** نظام إدارة قضايا الدولة السورية
**Name (English):** State Litigation Management System

## 1. Purpose

Hierarchical institutional system automating the lifecycle of Syrian state litigation cases: registration → hearings → decisions → appeals → execution. Supports document attachments, reminders, notifications, and role-based coordination. Arabic-first UI with RTL layout.

**Current status:** Demo-ready. Pilot-capable with DBA support. NOT production-hardened — see `docs/project/FINAL_PRODUCTION_BLOCKERS.md`.

## 2. Stack

| Layer | Tech | Version |
|---|---|---|
| Backend | Java + Spring Boot | Java 21, Spring Boot 3.3.4 |
| Build | Maven | 3.9+ |
| DB | PostgreSQL | 14+ (16 in Docker) |
| Migrations | Flyway | 25 migrations (V1–V25) |
| Auth | Spring Security + JJWT | 0.12.6 |
| Frontend | React + TypeScript | React 18.3.1, TS 5.5.4 |
| Build tool (FE) | Vite | 5.4.8 |
| Data fetching | TanStack Query | v5.59 |
| Forms | React Hook Form + Zod | 7.53 + 3.23 |
| Styling | Tailwind CSS | 3.4.13 |
| Icons | Lucide React | 0.451 |
| HTTP | Axios | 1.7.7 |
| Routing | React Router | 6.26 |
| Tests (FE) | Vitest + Playwright | 2.1 + 1.48 |
| Tests (BE) | JUnit 5 + Testcontainers | 1.20 |
| API docs | SpringDoc OpenAPI | 2.6 |
| Deploy | Docker Compose + Nginx | — |

## 3. Repo Layout

```
court-platform/
├── backend/                      Spring Boot app
├── frontend/                     React/Vite SPA
├── docs/                         Deployment & project docs
│   ├── deployment/               Deployment guides, env notes
│   └── project/                  Phase status, closure reports, blockers
├── scripts/                      Launcher & seed scripts
├── docker-compose.demo.yml       Full-stack demo compose
├── sla-demo.nginx.conf           Root-level nginx config (reverse proxy)
├── test_login.py                 Python script: POST /login, print token
└── README.md
```

## 4. Backend

**Root package:** `sy.gov.sla` (→ `backend/src/main/java/sy/gov/sla/`)
**Main class:** `SlaApplication.java`
**Config:** `backend/src/main/resources/application.yml`
**Migrations:** `backend/src/main/resources/db/migration/V*.sql` (V1–V25)

### Module layout (18 top-level packages)

Each module follows layered structure: `api/` (controllers + DTOs) · `application/` (services) · `domain/` (entities, enums) · `infrastructure/` (repositories, ports).

| Module | Purpose |
|---|---|
| `access` | RBAC, delegation, court-specific access |
| `attachments` | File upload/download (local FS, 50MB, SHA-256) |
| `circulars` | Read-only reference: legal circulars |
| `common` | Shared exceptions, DTOs, `PageResponse<T>`, error handler |
| `decisionfinalization` | Case decision finalization workflow |
| `execution` | Post-judgment execution phase |
| `identity` | Users, auth, password reset (OTP) |
| `legallibrary` | Read-only reference: legal docs |
| `litigationprogression` | Hearing progression, postponements |
| `litigationregistration` | Case registration & stage management |
| `notifications` | Event-driven (e.g., CaseRegisteredEvent, LawyerAssignedEvent) |
| `organization` | Branches, departments, courts |
| `publicentitydirectory` | Read-only reference: government entities |
| `reminders` | Per-user personal reminders |
| `resolvedregister` | Appeal register (computed read model) |
| `security` | JWT filter, `SecurityConfig`, utilities |
| `stagetransition` | Stage transitions |

### Auth

- JWT (JJWT 0.12.6) — access token 30 min, refresh 14 days, rotation on refresh
- Filter: `security/JwtAuthenticationFilter`
- Authz: `AuthorizationService`, `AccessControlService`
- 6 roles: `CENTRAL_SUPERVISOR`, `BRANCH_HEAD`, `SECTION_HEAD`, `STATE_LAWYER`, `ADMIN_CLERK`, `READ_ONLY_SUPERVISOR`
- JWT secret: env `SLA_JWT_SECRET` (base64 HMAC-SHA256, ≥32 bytes)

### REST conventions

- Versioned: `/api/v1/<feature>/*`
- Controllers in `*/api/*Controller.java`
- DTOs in same `api/` package
- Paginated responses: `PageResponse<T>`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `/v3/api-docs`

### DB/Hibernate

- `ddl-auto: validate` — schema must be Flyway-migrated first
- Time zone: UTC
- Key tables: `users`, `roles`, `user_roles`, `litigation_cases`, `case_stages`, `hearing_progression_entries`, `attachments`, `reminders`, `notifications`

### Key env vars

- `DB_URL`, `DB_USER`, `DB_PASSWORD`
- `SLA_JWT_SECRET`
- `SLA_ATTACHMENTS_BASE_DIR` (default `./attachments-data/`)
- `SLA_BOOTSTRAP_ADMIN_ENABLED` (default `true` — must disable in prod)

## 5. Frontend

**Root:** `frontend/src/`
**Entry:** `main.tsx` → `App.tsx` → `app/router.tsx`

### Folder layout

```
src/
├── app/
│   ├── queryClient.ts            TanStack Query setup
│   └── router.tsx                React Router v6 routes
├── features/                     Domain modules
│   ├── admin-users/              User/role admin (Phase 11)
│   ├── attachments/
│   ├── auth/                     AuthContext, login, reset
│   ├── cases/
│   ├── execution/
│   ├── knowledge/                Legal library, circulars, entities
│   ├── layout/                   AppShell, Header, Sidebar, MobileSidebar
│   ├── navigation/               Nav items config (role-filtered)
│   ├── notifications/
│   ├── profile/
│   ├── reminders/
│   └── resolvedregister/
├── pages/                        Page wrappers (lazy-loaded)
├── shared/
│   ├── api/                      http.ts (axios + interceptors), users, lookups
│   ├── config/
│   ├── lib/                      cn.ts (clsx+tw-merge), tokenStorage
│   ├── types/domain.ts           Shared types + ROLE_LABEL_AR
│   └── ui/                       Button, PageHeader, primitives (CVA-based)
└── test/
```

### Key files

- `features/auth/AuthContext.tsx` — login state, token refresh, role checks (tokens in localStorage — XSS risk, dev only)
- `features/layout/AppShell.tsx` — layout root (desktop Sidebar + mobile drawer)
- `features/layout/Header.tsx` — user name, role (Arabic), logout, hamburger trigger
- `features/layout/MobileSidebar.tsx` — RTL-aware slide-out drawer (closes on Escape/backdrop/route change)
- `shared/ui/PageHeader.tsx` — reusable title with optional `actions` prop
- `shared/api/http.ts` — axios instance, JWT injection, 401 → refresh → retry

### UI conventions

- No component lib (no MUI/AntD/Chakra). Custom Tailwind + CVA variants + Lucide icons.
- RTL: use `rtl:` / `ltr:` Tailwind modifiers (e.g., `rtl:-translate-x-full`)
- All text hard-coded in Arabic; no i18n library currently

## 6. Key Features (Backend ↔ Frontend)

| Domain | Backend module | Frontend feature |
|---|---|---|
| Identity | `identity` | `auth` |
| Access/RBAC | `access` | (AuthContext) |
| Case registration | `litigationregistration` | `cases` |
| Hearings | `litigationprogression` | `cases` (detail) |
| Decisions | `decisionfinalization` | (in cases) |
| Appeals | `resolvedregister` | `resolvedregister` |
| Execution | `execution` | `execution` |
| Attachments | `attachments` | `attachments` |
| Reminders | `reminders` | `reminders` |
| Notifications | `notifications` | `notifications` |
| Legal library | `legallibrary` | `knowledge` |
| Public entities | `publicentitydirectory` | `knowledge` |
| Circulars | `circulars` | `knowledge` |
| Org structure | `organization` | (config) |
| User admin | `identity` admin | `admin-users` (Phase 11) |

## 7. Dev Workflow

### Backend (local)

```bash
cd backend
# set DB_URL, DB_USER, DB_PASSWORD, SLA_JWT_SECRET
mvn clean package -DskipTests
java -jar target/state-litigation-backend-0.1.0-SNAPSHOT.jar
# Swagger: http://localhost:8080/swagger-ui.html
```

Scripts: `scripts/run_backend.bat`, `scripts/test_backend.bat`

### Frontend (local)

```bash
cd frontend
npm install
npm run dev            # Vite dev server on :5173
npm run build          # TS check + Vite build → dist/
npm run lint
npm run format
npm test               # Vitest
npm run test:e2e       # Playwright headless
npm run test:e2e:headed
npm run test:e2e:ui
```

### Docker demo (full stack)

```bash
cp .env.demo.example .env.demo      # set DB_PASSWORD, SLA_JWT_SECRET
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
# Frontend: http://localhost  (Nginx → SPA + /api proxy)
# Backend:  :8080  (health: /v3/api-docs)
# DB:       PostgreSQL 16 Alpine, volume sla-demo-db
# Attachments volume: sla-demo-attachments
```

Helper scripts: `scripts/demo-up.{sh,bat}`, `scripts/demo-down.{sh,bat}`, `scripts/demo-update.{sh,bat}`

### Demo credentials (all pw: `ChangeMe!2026`)

- `admin` → CENTRAL_SUPERVISOR
- `section_fi_dam` → SECTION_HEAD (main demo flow)
- `lawyer_fi_dam` → STATE_LAWYER
- `clerk_fi_dam` → ADMIN_CLERK
- `viewer` → READ_ONLY_SUPERVISOR

## 8. Important docs

- `docs/deployment/DEMO_DEPLOYMENT_GUIDE.md` — server deployment steps
- `docs/deployment/GITHUB_HANDOFF_GUIDE.md` — new dev onboarding
- `docs/deployment/DEMO_ENVIRONMENT_NOTES.md` — demo limitations (OTP to console, local FS, no TLS)
- `docs/project/PROJECT_PHASE_STATUS.md` — phase completion matrix
- `docs/project/NEXT_CHAT_CONTEXT.md` — full context for next session
- `docs/project/FINAL_PROJECT_CLOSURE_REPORT.md` — architecture decisions D-001..D-046
- `docs/project/FINAL_PRODUCTION_BLOCKERS.md` — 14+ prod blockers
- `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md` — roadmap to prod

## 9. Production blockers (high-level)

**Critical:** JWT in localStorage (→ httpOnly cookies), local FS attachments (→ S3/MinIO), no rate limiting, no secrets management (→ Vault/KMS)
**High:** OTP console-only (no SMS), no backups/DR, no HTTPS in compose, bootstrap admin auto-creates
**Medium:** No AV scan on uploads, no scheduler, no audit logging, must-change-password not enforced (D-049)

## 10. Architecture decisions (selected)

- D-018/D-019: bootstrap admin, JWT + refresh rotation
- D-020/D-021: case ownership & role-scoped reads
- D-022–D-024: append-only hearing progression, lawyer-only finalization
- D-025–D-027: appeals via promote-to-appeal + delegation
- D-028–D-034: execution phase + step tracking
- D-035–D-039: attachments, reminders (personal), notifications (event-driven)
- D-040–D-042: knowledge modules (read-only, JPA Specifications)
- D-046: assign-lawyer endpoint + UI
- D-047/D-048: user admin endpoints + role constraints
- D-049: must-change-password on first login (pending)

## 11. Current work in progress (uncommitted at session start)

Files touched:

- `backend/pom.xml` — added UTF-8 encoding properties
- `backend/.../attachments/application/AttachmentService.java` — switch-case block syntax cleanup (lines ~155–156)
- `frontend/src/features/layout/AppShell.tsx` — mobile nav state + MobileSidebar integration
- `frontend/src/features/layout/Header.tsx` — hamburger button, responsive display of name/role
- `frontend/src/features/layout/MobileSidebar.tsx` — NEW — RTL-aware slide-out drawer
- `frontend/src/shared/ui/PageHeader.tsx` — added optional `actions` prop for right-aligned actions

Theme: **Phase 11 mobile responsive navigation** + minor polish.

## 12. Key file paths (quick ref)

**Backend**
- Main: `backend/src/main/java/sy/gov/sla/SlaApplication.java`
- Config: `backend/src/main/resources/application.yml`
- Controllers: `backend/src/main/java/sy/gov/sla/*/api/*Controller.java`
- Services: `backend/src/main/java/sy/gov/sla/*/application/*Service.java`
- Entities: `backend/src/main/java/sy/gov/sla/*/domain/*.java`
- Migrations: `backend/src/main/resources/db/migration/V*.sql`

**Frontend**
- Entry: `frontend/src/main.tsx`
- Router: `frontend/src/app/router.tsx`
- Auth: `frontend/src/features/auth/AuthContext.tsx`
- Layout: `frontend/src/features/layout/{AppShell,Header,Sidebar,MobileSidebar}.tsx`
- HTTP client: `frontend/src/shared/api/http.ts`
- Types: `frontend/src/shared/types/domain.ts`

**Docker**
- Compose: `docker-compose.demo.yml`
- Backend Dockerfile: `backend/Dockerfile`
- Frontend Dockerfile: `frontend/Dockerfile`
- Nginx (in image): `frontend/nginx/nginx.conf`
- Nginx (root alternative): `sla-demo.nginx.conf`
