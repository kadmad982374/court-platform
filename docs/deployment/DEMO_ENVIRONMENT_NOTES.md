# Demo Environment Notes
## State Litigation Management System

This document records all demo-only choices and their known limitations.  
It is the honest reference for anyone evaluating or extending this system.

---

## Demo-only choices

### 1. JWT in localStorage
- **What:** Access and refresh tokens are stored in `localStorage` via the `tokenStorage` port (decision D-044).
- **Why demo-only:** Vulnerable to XSS. Production requires httpOnly cookies (D-049).
- **Impact:** Low risk for internal demo; unacceptable for internet-facing production.

### 2. Local filesystem attachment storage
- **What:** Uploaded files are saved to `./attachments-data/` (or `/app/attachments-data` in Docker).
- **Why demo-only:** No redundancy, no CDN, no virus scanning.
- **Impact:** Files are accessible as long as the volume exists. Not suitable for production scale.
- **Migration path:** Replace `LocalFilesystemAttachmentStorage` with S3/MinIO implementation (port already defined, D-050).

### 3. OTP via console logs (no SMS)
- **What:** Password-reset OTP codes are printed to backend logs only.
- **Why demo-only:** No SMS provider is configured.
- **How to use in demo:** `docker compose -f docker-compose.demo.yml logs backend | grep OTP`
- **Production path:** Integrate real SMS provider (D-052).

### 4. BootstrapAdminRunner enabled
- **What:** On every startup, if `admin` user doesn't exist, it creates it with `SLA_BOOTSTRAP_ADMIN_PASSWORD`.
- **Why demo-only:** Convenient for demo reset; dangerous in production (re-creates admin on restart).
- **Production action:** Set `SLA_BOOTSTRAP_ADMIN_ENABLED=false` and disable the runner entirely.

### 5. V20 dev seed users (Flyway migration)
- **What:** Migration V20 inserts 9 demo accounts with password `ChangeMe!2026`.
- **Why demo-only:** Known credentials in migration history.
- **Production action:** Delete V20 migration file before first production deployment.

### 6. No rate limiting
- **What:** No request throttling on login or OTP endpoints.
- **Why demo-only:** Acceptable for controlled demo; unacceptable for public deployment.

### 7. No HTTPS in docker-compose.demo.yml
- **What:** Demo compose exposes HTTP on port 80.
- **Why demo-only:** TLS should be terminated at the host (Nginx/Caddy/Traefik) for real access.
- **Recommended:** Put Caddy or Nginx on the host and reverse-proxy to the demo port.

### 8. No backup or DR
- **What:** Database and attachments are in named Docker volumes only.
- **Risk:** Data loss on volume deletion or server failure.
- **Demo use:** Acceptable for short demo period.

---

## What the client can safely test in demo

- ✅ Full case lifecycle: NEW → ACTIVE → FINALIZED → IN_EXECUTION
- ✅ Hearing progression and postponement reasons (free text)
- ✅ Finalization record and appeal/re-open flow
- ✅ Execution file + step management
- ✅ Attachment upload / download (local volume)
- ✅ Reminders (create, update, mark done)
- ✅ Notifications (auto-generated, read/unread)
- ✅ Legal library + public entities + circulars (read-only)
- ✅ Assign lawyer to case
- ✅ User and role management (/admin/users)
- ✅ Forgot / reset password (OTP from logs)
- ✅ Permission-based UI: hidden sections based on role/permissions

---

## Known demo limitations the client should be aware of

| Limitation | Note |
|-----------|------|
| OTP by SMS | OTP visible in logs only — no real phone message |
| Postponement reason dropdown | Free text for now — dropdown from master list is a future improvement |
| Lawyer name in stage/execution detail header | Minor display gap — does not affect functionality |
| No real-time push | Notifications require page refresh to appear |
| No audit review UI | Audit records are created but no UI to browse them yet |

---

## Production blockers (not started)

All production blockers are documented in:  
→ `docs/project/FINAL_PRODUCTION_BLOCKERS.md`

Ordered production readiness plan:  
→ `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md`

Estimated effort to reach production: **6–10 weeks** of focused engineering work.

---

## Safe demo expectations

The system is suitable for:
- Client acceptance testing of implemented flows
- Internal pilot with a small controlled group (DBA/legal team)
- Demonstration to stakeholders

The system is **NOT** suitable for:
- Live production data
- Public internet exposure without TLS + hardening
- Wide pilot (50+ users) without at least httpOnly cookies + rate limiting

