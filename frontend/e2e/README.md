# Playwright Browser E2E — How to Run

> Real browser tests against the live React UI + live Spring Boot backend.
> Chromium only. Arabic / RTL aware. Uses the V22 demo seed users.

---

## 1) Pre-conditions

You must have **all three** running before invoking the tests:

| # | Component | How to start | Verify |
|---|-----------|--------------|--------|
| 1 | PostgreSQL 16 | system service / Docker | `psql -U postgres -c '\l'` |
| 2 | Backend (Spring Boot, port 8080) | `scripts\run_backend.bat` or `mvn -f backend\pom.xml spring-boot:run` | `curl http://localhost:8080/actuator/health` (or any auth endpoint) |
| 3 | V22 demo seed | applied automatically by Flyway when backend boots | backend log: `V22 demo seed complete` |

You do **not** need to start the Vite dev server manually — Playwright's
`webServer` config auto-launches `npm run dev` on `http://localhost:5173`
and proxies `/api` → backend.

If you want to point at a different backend:
```powershell
$env:E2E_BACKEND_URL = "http://10.0.0.5:8080"
npm run test:e2e
```

---

## 2) One-time install

From the `frontend/` folder:

```powershell
npm install
npm run test:e2e:install   # downloads Chromium browser binary (~150 MB)
```

This adds `@playwright/test` (already declared in `package.json`) and the
Chromium binary into `~/AppData/Local/ms-playwright/`.

---

## 3) Available scripts

| Command | What it does |
|---------|--------------|
| `npm run test:e2e` | Run the full E2E suite headless in Chromium |
| `npm run test:e2e:headed` | Same suite, visible browser window (good for debugging) |
| `npm run test:e2e:ui` | Open Playwright's interactive UI runner |
| `npm run test:e2e:report` | Open the HTML report from the last run |
| `npm run test:e2e:install` | Re-install / update the Chromium binary |

To run a single spec:
```powershell
npx playwright test e2e/tests/04-case-detail-assign-lawyer.spec.ts
```

To run a single test by name:
```powershell
npx playwright test -g "section_head can assign a lawyer"
```

---

## 4) What is captured on failure

Configured in `playwright.config.ts`:

- **Screenshot** — `only-on-failure`
- **Video**      — `retain-on-failure`
- **Trace**      — `retain-on-failure` (open with `npx playwright show-trace path/to/trace.zip`)
- **HTML report** — generated under `e2e/.artifacts/html-report/`

All artifacts land under `frontend/e2e/.artifacts/` (git-ignored).

---

## 5) Folder layout

```
frontend/
├── playwright.config.ts        ← Chromium project, baseURL :5173, webServer
└── e2e/
    ├── README.md               ← this file
    ├── .gitignore              ← ignores .artifacts/
    ├── fixtures/
    │   ├── users.ts            ← demo accounts (V20/V21/V22 seed)
    │   └── auth.ts             ← loginAs / logout / navigateBySidebar helpers
    └── tests/
        ├── 01-auth.spec.ts                                ← login + bad pwd + protected route + logout
        ├── 02-navigation.spec.ts                          ← sidebar across roles
        ├── 03-create-case.spec.ts                         ← SECTION_HEAD creates a case end-to-end
        ├── 04-case-detail-assign-lawyer.spec.ts           ← assign-lawyer (D-046, post-V22)
        ├── 05-hearing-progression.spec.ts                 ← rollover/finalize entry-point visibility
        ├── 06-resolved-register.spec.ts                   ← month/year filter
        ├── 07-execution.spec.ts                           ← execution files list + detail
        ├── 08-knowledge.spec.ts                           ← legal library / entities / circulars
        ├── 09-notifications-reminders-attachments.spec.ts ← inbox + reminders + attachments presence
        └── 10-known-gaps.spec.ts                          ← test.skip with documented reasons
```

---

## 6) Selector strategy (stable selectors used)

In priority order:

1. **`data-testid`** — already present on the assign-lawyer section (`assign-lawyer-section`, `assign-lawyer-submit`, `assign-lawyer-success`, `assign-lawyer-error`, `current-owner-label`).
2. **Form `id`** — `#username`, `#password` on the login page.
3. **`getByRole`** with Arabic accessible name — buttons (`دخول`, `قيد الدعوى`, `ترحيل الجلسة`, `فصل المرحلة`), links (`الدعاوى`, `سجل الفصل`, …).
4. **`getByLabel`** for form fields — uses the visible Arabic `<label>` text.
5. **`href` patterns** — `a[href^="/cases/"]`, `a[href^="/stages/"]`, etc., for table-row navigation.

We deliberately avoid CSS chains coupled to Tailwind classes.

---

## 7) Demo accounts used

All passwords are `ChangeMe!2026` (declared in `e2e/fixtures/users.ts`).

| Key | Username | Role | Used by |
|-----|----------|------|---------|
| `admin` | admin | CENTRAL_SUPERVISOR | reserved |
| `branchHead` | head_dam | BRANCH_HEAD | reserved |
| `sectionHead` | section_fi_dam | SECTION_HEAD | most write paths |
| `clerk` | clerk_fi_dam | ADMIN_CLERK (+ASSIGN_LAWYER) | (extension) |
| `clerkNoAssign` | clerk2_fi_dam | ADMIN_CLERK (-ASSIGN_LAWYER) | (extension) |
| `lawyer` | lawyer_fi_dam | STATE_LAWYER (owns Case 2 + 4) | hearing/reminders |
| `lawyer2` | lawyer2_fi_dam | STATE_LAWYER | non-owner negative path |
| `lawyerInactive` | lawyer_inactive_fi | STATE_LAWYER (inactive) | must NOT appear in lists |
| `lawyerAppeal` | lawyer_app_dam | STATE_LAWYER (APPEAL) | (extension) |
| `viewer` | viewer | READ_ONLY_SUPERVISOR | read-only checks |

---

## 8) What is fully testable vs blocked

| Scenario | Status in this E2E suite | Reason |
|----------|--------------------------|--------|
| Auth (login/logout/bad pwd/protected route) | ✅ Full | Real form, real backend |
| Sidebar navigation per role | ✅ Full | — |
| Create case (SECTION_HEAD) | ✅ Full | Form-driven |
| Create case rejected (viewer/lawyer) | ✅ Full | Page renders gating message |
| Open case detail | ✅ Full | — |
| Assign lawyer list filtering | ✅ Full | Inactive lawyer excluded; active lawyers shown |
| Assign lawyer POST | ✅ Full | First run assigns; re-runs land in already-assigned state (idempotent) |
| Hearing rollover/finalize **buttons visible/hidden** | ✅ Full | Owner sees, non-owner doesn't |
| Hearing rollover/finalize **mutation** | ⚠️ Out of suite scope | Would mutate shared seed — covered API-level in `DEMO_SEED_RUNTIME_VERIFICATION.md` |
| Resolved register (filters) | ✅ Full | — |
| Execution files (list + detail) | ✅ Full | — |
| Knowledge directory (3 modules) | ✅ Full | — |
| Notifications inbox | ✅ Full | — |
| Notifications mark-as-read | ✅ Best-effort (skipped if all already read) | — |
| Reminders presence (Case 2) | ✅ Full | — |
| Attachments section presence (Case 2 stage) | ✅ Full | — |
| **Attachment download** | ⏭️ `test.skip` | Local-FS storage gap (D-035 / KNOWN-GAP-004); seed has metadata only |
| **Reset password OTP loop** | ⏭️ `test.skip` | OTP printed to backend log only (ENV-LIMIT-002) |
| **User Admin CRUD UI** | ⏭️ `test.skip` | Mini-Phase B not built (KNOWN-GAP-001) |
| **Postponement reasons HTTP lookup** | ⏭️ `test.skip` | No backend endpoint (KNOWN-GAP-002) |
| **httpOnly-cookie token storage** | ⏭️ `test.skip` | localStorage by D-044, requires D-049+ (KNOWN-GAP-003) |
| **Promote-to-execution live POST** | ⏭️ `test.skip` | Case 4 pre-promoted by V22 seed; no fresh promotable case |

The skipped items are explicitly marked `test.skip(...)` in
`tests/10-known-gaps.spec.ts` so they appear in the report as
**skipped (documented gap)** instead of being silently absent.

---

## 9) CI tip

For CI runners, set `CI=1` to enable retries and `forbidOnly`:

```powershell
$env:CI = "1"
npm run test:e2e
```

---

## 10) Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Error: connect ECONNREFUSED 127.0.0.1:8080` | Backend not running | Start backend per §1 |
| Login test fails with Arabic "بيانات الدخول غير صحيحة" | Demo seed not applied (V20–V22) | Re-apply Flyway migrations / re-seed DB |
| `playwright not found` | Skipped install step | `npm install` then `npm run test:e2e:install` |
| Tests can't find Chromium binary | Browser not installed | `npm run test:e2e:install` |
| Empty / silent terminal output (Arabic CWD on PowerShell 5.1) | ENV-LIMIT-004 | Run from `cmd.exe` or PowerShell 7, or copy project to a Latin-only path for the test session |
| Test changes seed state across runs | Tests are designed idempotent — assign-lawyer accepts both fresh and re-assign states; create-case uses `Date.now()`-based unique numbers | — |

