# Audit Findings — Todo List

**Audit date:** 2026-04-23
**Source:** Read-only validation pipeline (memory-keeper READ → backend-architect + clean-code-refactor + database-performance + security-auditor + frontend/UX/a11y + testing-specialist + devops-automation)
**Scope:** Entire project at `C:\Users\FAD\IdeaProjects\lawyer\court-platform\`
**Status:** No code changed — this is the backlog

**Severity legend:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MED · 🟢 LOW

---

## Phase 0 — Decisions needed from user (BLOCKING)

These must be answered before Phase 1 can start — the fixes branch differently depending on the answer.

- [ ] **D-Q1:** JWT storage — stay in `localStorage` (demo/pilot only, isolated network) or migrate to `httpOnly` cookies now? *Affects refresh flow, CORS, CSRF strategy, and ~half of the Phase 1 fixes.*
- [ ] **D-Q2:** OTP delivery — console-only for demo, or wire an SMS vendor? If SMS: which one (Twilio, local Syrian gateway, other)?
- [ ] **D-Q3:** File storage — keep local FS with the new hardening, or move to S3/MinIO in the same pass?
- [ ] **D-Q4:** Lockout policy — threshold (default proposal: 5 fails in 15 min → 30 min lock) and whether to notify user.
- [ ] **D-Q5:** CORS allowed origins — env-driven list; what hostnames for pilot?
- [ ] **D-Q6:** D-049 (must-change-password on first login) — enforce in this pass or leave pending?

---

## Phase 1 — Auth + headers hardening (pipeline: security-auditor → backend-architect → testing-specialist → qa)

Risk: **medium** · Est: 2–3 sessions

### 🔴 Critical

- [ ] **P1-01** Refresh-token reuse detection — on reuse of a revoked RT, revoke the entire token family for that user · `AuthService.java:66-82`
- [ ] **P1-02** `refresh()` must recheck `user.isActive() && !user.isLocked()` and reject if either fails · `AuthService.java:66-82`
- [ ] **P1-03** JWT filter must NOT silently swallow `JwtException` — log at WARN with token metadata + IP, emit metric, keep 401 response uniform · `JwtAuthenticationFilter.java:31-44`

### 🟠 High

- [ ] **P1-04** JWT parser: enforce issuer (`requireIssuer(props.issuer())`) and add `.clockSkewSeconds(30)` · `JwtService.java:42-48`
- [ ] **P1-05** `application.yml`: set `server.error.include-message: never` (move to prod profile, keep `always` only in dev profile) · `application.yml:25`
- [ ] **P1-06** Add login lockout: `failed_login_count` + `locked_until` columns, increment on fail, reset on success, honor `User.isLocked` · `AuthService.java:50-64`, new Flyway migration
- [ ] **P1-07** Scrub OTP plaintext from logs — `LoggingOtpDispatcher` must log metadata only (user id hash, timestamp), never the code or mobile · `LoggingOtpDispatcher.java:11`
- [ ] **P1-08** Fix user-enumeration timing in `forgotPassword` — perform constant-time dummy work when user not found · `AuthService.java:92-108`
- [ ] **P1-09** Cap active/unconsumed OTP codes per user (e.g., max 3 unconsumed) + rate-limit `/forgot-password` · `AuthService.java:110-132`
- [ ] **P1-10** `resetPassword`: replace `findAll()` + in-memory filter with `refreshTokenRepository.findByUserIdAndRevokedFalse(userId)` · `AuthService.java:129-131`, new repository method
- [ ] **P1-11** Add `CorsConfigurationSource` bean — allowed origins from env (answer from D-Q5), `allowCredentials=false` (or `true` if D-Q1 moves to cookies) · `SecurityConfig.java:32`
- [ ] **P1-12** Configure security headers explicitly in `SecurityConfig.headers(...)`: HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, basic CSP · `SecurityConfig.java`

### 🟡 Medium

- [ ] **P1-13** Add `jti` claim to access tokens + denylist table for pre-expiry revocation on sensitive events · `JwtService.java:31-40`, new entity + migration
- [ ] **P1-14** `UserAdminService.patch` — when setting `active=false`, revoke all user's refresh tokens · `UserAdminService.java:144-146`
- [ ] **P1-15** Startup assertion: refuse to start if `SLA_JWT_SECRET` equals shipped dev default · `JwtService.java:22-26` (@PostConstruct)

### 🟢 Low

- [ ] **P1-16** `BootstrapAdminRunner`: set `mustChangePassword=true` on first create (combine with D-Q6 decision) · `BootstrapAdminRunner.java:38`
- [ ] **P1-17** `AuthController.logout` — assert the submitted RT belongs to the authenticated principal; otherwise reject · `AuthController.java:25-28`

---

## Phase 2 — Upload/download safety (pipeline: security-auditor → backend-architect → testing-specialist → qa)

Risk: **low** · Est: 1 session

### 🟠 High

- [ ] **P2-01** Server-side MIME allow-list (pdf / docx / xlsx / png / jpg + whatever domain needs) on upload · `AttachmentService.java:126-127`
- [ ] **P2-02** Magic-byte sniff on upload — don't trust client-supplied `contentType` · `AttachmentService.java:126-127`
- [ ] **P2-03** Force `Content-Type: application/octet-stream` on download + `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` · `AttachmentController.java:63`
- [ ] **P2-04** Filename sanitization: do not keep attacker-controlled extension. Re-derive extension from sniffed MIME, truncate from the front if needed · `LocalFilesystemAttachmentStorage.java:88`

### 🟡 Medium

- [ ] **P2-05** `AttachmentController.download` — catch `InvalidMediaTypeException` from `MediaType.parseMediaType` and fall back to `application/octet-stream` · `AttachmentController.java:63`

---

## Phase 3 — Performance / N+1 fixes (pipeline: database-performance → backend-architect → testing-specialist → qa)

Risk: **low** · Est: 1 session

### 🟠 High

- [ ] **P3-01** Fix N+1 in `LitigationCaseService.listCases` — batched `findByLitigationCaseIdIn(ids)` + in-memory group-by (or fetch-join `@Query`) · `LitigationCaseService.java:170`
- [ ] **P3-02** Fix N+1 in `UserAdminService.list` + `rolesOf` — lift `roleRepository.findAll()` out of the loop, bulk-load memberships via `userRoleRepository.findByUserIdIn(ids)` · `UserAdminService.java:213, 272-281`

### 🟡 Medium

- [ ] **P3-03** Extract `buildScopeSpec` from `LitigationCaseService` into `LitigationCaseScopeSpecifications` helper (reduce complexity ~8-10 → ~3) · `LitigationCaseService.java:176-207`
- [ ] **P3-04** Extract scope spec logic from `ExecutionService` into `ExecutionScopeSpecifications` · `ExecutionService.java:148-178`
- [ ] **P3-05** Extract `UserAdminService.list`'s inline `Specification` into `UserAdminSpecifications` (split out subqueries) · `UserAdminService.java:177-209`

### 🧪 Test requirement for this phase

- [ ] **P3-T1** Add query-count assertions to `LitigationCaseServiceIT.listCases` and `UserAdminServiceIT.list` using Hibernate `Statistics` — so N+1 regressions fail CI

---

## Phase 4 — D-023 retrofit (pipeline: backend-architect → clean-code-refactor → database-performance → testing-specialist → qa)

Risk: **medium-high** (wide blast radius) · Est: 2 sessions

### 🟡 Medium

- [ ] **P4-01** Introduce `AccessPort` in `access/domain/` exposing read-only queries needed by `identity` (role listings, delegations, court access) · new file
- [ ] **P4-02** Introduce `OrganizationPort` in `organization/domain/` exposing branch/department lookups · new file
- [ ] **P4-03** Migrate `identity/application/UserAdminService` off direct `access.infrastructure.*Repository` and `organization.infrastructure.*Repository` imports · `UserAdminService.java:23-40`
- [ ] **P4-04** Migrate `identity/application/UserRoleAdminService` · `UserRoleAdminService.java:11-12`
- [ ] **P4-05** Migrate `identity/application/UserMembershipAdminService` · `UserMembershipAdminService.java:11,19-20`
- [ ] **P4-06** Migrate `identity/application/UserDelegationAdminService` · `UserDelegationAdminService.java:11-12`
- [ ] **P4-07** Migrate `identity/application/UserCourtAccessAdminService` · `UserCourtAccessAdminService.java:10-11,19`
- [ ] **P4-08** Migrate `identity/application/UserQueryService` · `UserQueryService.java:15,22`
- [ ] **P4-09** Migrate `identity/application/AuthService` · `AuthService.java:9-10`
- [ ] **P4-10** Separate dev/demo seed migrations from schema migrations — move `V20__dev_seed_test_users.sql`, `V22__demo_seed_data.sql`, and any other seed-only V-migrations into `db/seed/` driven by a profile-gated `FlywayMigrationStrategy` (or repeatable migrations with `flyway.placeholders.seedEnabled`) · `backend/src/main/resources/db/migration/`
- [ ] **P4-11** Allocate **D-050** in the KB: "D-023 retrofit for identity/* via AccessPort + OrganizationPort"

---

## Phase 5 — Frontend a11y + WIP polish (pipeline: ux-ui-menu → testing-specialist → qa)

Risk: **low-medium** · Est: 2 sessions

### 🟠 High

- [ ] **P5-01** Create shared `Field` primitive in `shared/ui/` that wires `aria-invalid`, `aria-describedby`, and label → input association · new file
- [ ] **P5-02** Migrate `LoginPage` form to `Field` primitive · `features/auth/LoginPage.tsx`
- [ ] **P5-03** Migrate `CreateCasePage` form fields · `pages/CreateCasePage.tsx:337`
- [ ] **P5-04** Migrate `CreateUserModal` form fields · `features/admin-users/CreateUserModal.tsx:133`
- [ ] **P5-05** Migrate `PromoteExecutionModal` form fields
- [ ] **P5-06** Migrate `RolloverModal` form fields
- [ ] **P5-07** Migrate any remaining forms (scan for `<input>`/`<select>`/`<textarea>` directly in JSX without the primitive)
- [ ] **P5-08** `Modal.tsx` — add focus trap + initial-focus management + focus restoration on close · `shared/ui/Modal.tsx`
- [ ] **P5-09** `MobileSidebar.tsx` — add focus trap + restore focus to hamburger button on close · `features/layout/MobileSidebar.tsx`

### 🟡 Medium

- [ ] **P5-10** `MobileSidebar.tsx:81` — replace `duration-250` with `duration-300` (valid Tailwind class) OR add `transitionDuration.250` to `tailwind.config.js` theme
- [ ] **P5-11** Add `React.lazy` + `<Suspense>` wrapper to heavy feature pages (admin-users, execution, reports) with a skeleton fallback · `src/app/router.tsx`
- [ ] **P5-12** Migrate ESLint to flat config (ESLint 9) and add `eslint-plugin-jsx-a11y` preset — would have caught the aria-invalid gaps at lint time
- [ ] **P5-13** Root `ErrorBoundary` around `<AppRouter/>` · `src/main.tsx`

### 🟢 Low

- [ ] **P5-14** `Sidebar.tsx:23` — replace physical `border-l` with logical `border-s` (or `border-e`, confirm design intent) · `features/layout/Sidebar.tsx:23`
- [ ] **P5-15** Add skip-to-content link at top of `AppShell` · `features/layout/AppShell.tsx`
- [ ] **P5-16** Remove dead `ltr:translate-x-full` from `MobileSidebar` (app is always `dir=rtl`) · `features/layout/MobileSidebar.tsx:82`
- [ ] **P5-17** Allocate **D-051** in the KB: "Phase 11 mobile nav + shared Field primitive + a11y baseline"

---

## Phase 6 — CI + coverage + nginx hardening (pipeline: devops-automation → security-auditor (nginx) → qa)

Risk: **low** · Est: 1 session

### 🟠 High — CI from scratch

- [ ] **P6-01** Create `.github/workflows/ci.yml` — on PR + push to main:
  - backend: `mvn -B verify` (runs tests + JaCoCo)
  - frontend: `npm ci && npm run lint && npm test && npm run build`
  - e2e (optional, separate workflow or PR label gate): `npm run test:e2e` against a spun-up docker-compose
- [ ] **P6-02** Add JaCoCo plugin to `backend/pom.xml` with initial threshold 40% line + 30% branch; plan to ratchet up · `backend/pom.xml`
- [ ] **P6-03** Add `@vitest/coverage-v8` to `frontend/package.json`, configure `coverage` block in `vitest.config.ts`, initial threshold 40%, `--coverage` in CI script · `frontend/vitest.config.ts`, `frontend/package.json`
- [ ] **P6-04** Add `dependabot.yml` for weekly backend Maven + weekly frontend npm updates · `.github/dependabot.yml`

### 🟠 High — nginx

- [ ] **P6-05** `frontend/nginx/nginx.conf` — add security headers block (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP)
- [ ] **P6-06** Enable gzip for text/js/css/json · `frontend/nginx/nginx.conf`
- [ ] **P6-07** Add `limit_req_zone` + `limit_req` for `/api/v1/auth/login` and `/api/v1/auth/forgot-password` (throttle brute force at the edge) · `frontend/nginx/nginx.conf`
- [ ] **P6-08** Delete or merge duplicate root-level `sla-demo.nginx.conf` — source of confusion with `frontend/nginx/nginx.conf` · repo root

### 🟡 Medium — Docker

- [ ] **P6-09** Add `.dockerignore` for backend — exclude `target/`, `*.iml`, `.idea/`, `.git/`, `test/`, logs · `backend/.dockerignore`
- [ ] **P6-10** Add `.dockerignore` for frontend — exclude `node_modules/`, `dist/`, `.git/`, `playwright-report/`, `test-results/` · `frontend/.dockerignore`
- [ ] **P6-11** Add healthcheck to `frontend` service in `docker-compose.demo.yml` (curl 80 → expect 200)
- [ ] **P6-12** `frontend depends_on: backend` — add `condition: service_healthy` · `docker-compose.demo.yml`

### 🟡 Medium — observability prep

- [ ] **P6-13** Add Spring Boot Actuator `/actuator/health` endpoint + health groups (readiness/liveness), switch backend healthcheck probe to `/actuator/health/liveness` · `backend/pom.xml`, `application.yml`, `docker-compose.demo.yml`

---

## Phase 7 — Tests for bare modules (pipeline: testing-specialist → qa)

Risk: **low** · Est: 1 session

### 🟠 High

- [ ] **P7-01** Unit tests for `security/JwtService` — issue/parse round-trip, expired token rejection, tampered signature rejection, wrong issuer rejection, clock-skew boundaries · new `JwtServiceTest.java`
- [ ] **P7-02** Unit tests for `security/JwtAuthenticationFilter` — valid token → Authentication set, malformed/expired/revoked → logged + anonymous, no token → anonymous · new `JwtAuthenticationFilterTest.java`
- [ ] **P7-03** Unit tests for `common/api/GlobalExceptionHandler` — AppException → structured envelope, validation → 400 + field details, unknown → 500 with generic message (and no leak) · new `GlobalExceptionHandlerTest.java`
- [ ] **P7-04** `@SpringBootTest` smoke test that ApplicationContext loads with `application-test.yml` · new `SlaApplicationSmokeTest.java`

---

## Phase 8 — Memory correction & bookkeeping (pipeline: memory-keeper WRITE only)

Risk: **none** · Runs at the end of every phase; called out here to not forget the corrections.

- [ ] **P8-01** Correct §11 (WIP) as Phase 11 mobile nav lands
- [ ] **P8-02** Correct inflated test counts in §12 / closure-report references — actual is **13 frontend unit test files** and **12 backend IT classes** (was reported as "~161" and "~40")
- [ ] **P8-03** Update §9 (Production blockers) — add items not originally listed (silent JWT filter, CORS no-op, missing MIME allow-list, missing headers, no CI, no coverage tooling, common/+security/ untested)
- [ ] **P8-04** Allocate decision numbers as phases land: **D-050** (D-023 retrofit), **D-051** (mobile nav + a11y baseline), **D-052** (CI + coverage gates), **D-053** (file-upload MIME allow-list policy), **D-054** (login lockout policy), **D-055** (JWT hardening: issuer/skew/jti/denylist)

---

## Not included (explicit non-goals for this backlog)

The following items require out-of-band decisions or vendor selection and are **not** in this todo list unless the user re-scopes:

- Moving JWT to `httpOnly` cookies (architectural change — see D-Q1)
- Wiring an SMS provider for OTP (see D-Q2)
- Migrating attachments to S3 / MinIO (see D-Q3)
- Adding audit logging (its own design discussion — what scope, what store, retention)
- Antivirus scanning on uploads (vendor: ClamAV? cloud AV?)
- Async job scheduler (Quartz? Spring Scheduling? external?)
- Backup / DR strategy (infra decision)

---

## Summary counts

- 🔴 Critical: **3**
- 🟠 High: **36**
- 🟡 Medium: **19**
- 🟢 Low: **6**
- ❓ Blocking decisions: **6**
- **Total actionable items: 64** across 8 phases

Estimated sessions to burn down: **~10–12** at 1 phase per session, assuming no follow-on discoveries during implementation.
