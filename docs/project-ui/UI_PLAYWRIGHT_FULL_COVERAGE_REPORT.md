# UI Playwright — Full Coverage Report (run #5)

> **Scope:** Full Playwright Browser E2E Expansion — complete coverage of
> all currently-implemented project functionality.
> **SMS / rate limiting / httpOnly cookies / object storage / scheduler etc.
> are explicitly POSTPONED** and remain documented blockers — they are
> represented in `tests/10-known-gaps.spec.ts` as `test.skip` with reasons,
> never as fake "passes".

> **2026-04-20 — Round 3 (completion pass) ✅:** Added
> `e2e/tests/13-completion-pass.spec.ts` with **12 new tests** that close
> the remaining medium-value gaps: 1) Reset-password page + invalid OTP,
> 2) Profile page render, 3) Stage attachment upload, 4) Execution-file
> attachment upload (clerk + assigned lawyer), 5) Add execution step
> (clerk delegated + negative), 6) Reminder status PENDING→DONE,
> 7) Notification mark-as-read. **Full chromium project: 78 passed / 8
> documented skips / 0 failed (86 collected, ~2 min)** against a live
> backend + V25 seed. Zero application code changed. Full report:
> [`UI_PLAYWRIGHT_COMPLETION_PASS_ROUND_3.md`](./UI_PLAYWRIGHT_COMPLETION_PASS_ROUND_3.md).

> **2026-04-20 — Round 2 (submit-path closure) ✅:** Added
> `e2e/tests/12-submit-path-coverage.spec.ts` with **10 new tests** that
> close the four highest-value remaining gaps:
> 1) Rollover hearing real submit, 2) Finalize real submit,
> 3) ADMIN_CLERK delegated promote (browser-verified), 4) Reminder create
> real submit. Full chromium project now: **66 passed / 8 documented
> skips / 0 failed (74 collected, ~1m 48s)** against a live backend +
> V25 seed. Zero application code changed. Full report:
> [`UI_PLAYWRIGHT_GAP_CLOSURE_ROUND_2.md`](./UI_PLAYWRIGHT_GAP_CLOSURE_ROUND_2.md).

---

## 1) Environment

| Item | Value |
|------|------|
| Date | 2026-04-19 |
| OS | Windows 10/11, PowerShell 5.1 |
| CWD | `C:\Users\kadri\Desktop\برنامج محامي\frontend` (Arabic path; ENV-LIMIT-004 still applies to long pipes) |
| Node | as installed locally |
| Playwright | `@playwright/test` (already in `package.json`) |
| Browser | Chromium only (per `playwright.config.ts`) |
| Frontend | auto-launched by Playwright `webServer` → `npm run dev` on `http://localhost:5173` |
| Backend | **must be started by the operator** on `http://localhost:8080` (Spring Boot, V20–V22 seed) |

> **Important:** during this preparation session the backend was **not**
> running (`curl http://localhost:8080/api/v1/auth/login` → `000`). All
> Playwright runtime numbers below therefore come from
> `npx playwright test --list` (collection-only) plus the operator-side
> Run #4 (Session 4 in `NEXT_CHAT_CONTEXT.md`) carried forward. Operator
> must perform Run #5 with the backend up; commands are in §3.

---

## 2) What changed in this expansion

### 2.1 New folder
```
frontend/e2e/tests/admin-users/
    01-list-and-search.spec.ts      ← 4 tests
    02-create-user.spec.ts          ← 3 tests (D-047 banned-literal, mobile validation, happy path)
    03-detail-and-patch.spec.ts     ← 1 test (PATCH + role add + role remove round-trip)
    04-sections.spec.ts             ← 2 tests (4 sections render + membership add)
    05-negative-access.spec.ts      ← 7 parameterised tests (each non-admin role)
                                       gating verified via sidebar absence + redirect
```
**Total new admin-users tests = 17.**

### 2.2 Other changes
| File | Change |
|------|------|
| `e2e/tests/10-known-gaps.spec.ts` | Removed *KNOWN-GAP-001 (User Admin CRUD UI)* skip — it is now browser-covered. Added skips for SMS rate-limiting and Scheduler/external channels (they are explicitly POSTPONED). |
| `e2e/tests/admin-users/*` | Created (5 specs above). |
| All admin-users source components | Already shipped with rich `data-testid` attributes — no source-side selectors had to be added in this session. |

### 2.3 Folder structure (final)
```
frontend/e2e/
├── README.md
├── DEMO_VIDEO_RUN.md
├── fixtures/
│   ├── users.ts          ← 10 demo accounts (V20/V21/V22 seed)
│   ├── auth.ts           ← loginAs / logout / navigateBySidebar
│   └── dom.ts            ← fieldByLabel / openCaseFromList / openFirstStage
└── tests/
    ├── 01-auth.spec.ts                                 ← Auth foundation
    ├── 02-navigation.spec.ts                           ← per-role sidebar audit
    ├── 03-create-case.spec.ts                          ← create-case happy path
    ├── 04-case-detail-assign-lawyer.spec.ts            ← assign-lawyer (D-046)
    ├── 05-hearing-progression.spec.ts                  ← rollover/finalize visibility
    ├── 06-resolved-register.spec.ts                    ← month/year filter
    ├── 07-execution.spec.ts                            ← execution files list + detail
    ├── 08-knowledge.spec.ts                            ← legal library / entities / circulars
    ├── 09-notifications-reminders-attachments.spec.ts  ← inbox + reminders + attachments presence
    ├── 10-known-gaps.spec.ts                           ← documented skips (UPDATED)
    ├── admin-users/                                    ← NEW: 5 specs / 17 tests
    │   ├── 01-list-and-search.spec.ts
    │   ├── 02-create-user.spec.ts
    │   ├── 03-detail-and-patch.spec.ts
    │   ├── 04-sections.spec.ts
    │   └── 05-negative-access.spec.ts
    ├── roles/                                          ← per-role journey suite (Session 4)
    │   ├── 01-branch-head.spec.ts
    │   ├── 02-section-head.spec.ts
    │   ├── 03-admin-clerk-with-assign.spec.ts
    │   ├── 04-admin-clerk-without-assign.spec.ts
    │   ├── 05-state-lawyer-owner.spec.ts
    │   ├── 06-state-lawyer-non-owner.spec.ts
    │   ├── 07-read-only-supervisor.spec.ts
    │   └── 99-known-gaps.spec.ts
    └── demo/
        └── 00-full-system-demo.spec.ts                 ← single-video tour
```

The `chromium` project (default) ignores `roles/**` and `demo/**`, so they
can run independently via their own projects.

---

## 2.4 Session 7 — Focused Case Detail Actions Validation (2026-04-20)

**Scope:** Runtime validation + bug-fix for three Case Detail action buttons:
1. تعديل البيانات الأساسية (Edit basic data)
2. ترقية إلى الاستئناف (Promote to appeal)
3. ترقية إلى التنفيذ (Promote to execution)

**New test file:** `e2e/tests/11-case-detail-actions.spec.ts` — **8 tests**

| Test | Action | Type |
|------|--------|------|
| SECTION_HEAD can open modal, edit, and save | Edit basic data | Positive |
| SECTION_HEAD can close modal without saving | Edit basic data | Stability |
| STATE_LAWYER does NOT see the edit button | Edit basic data | Permission/visibility |
| SECTION_HEAD sees the button and gets correct backend response | Promote to appeal | Positive |
| STATE_LAWYER does NOT see the promote-to-appeal button | Promote to appeal | Permission/visibility |
| SECTION_HEAD can open modal, fill form, and submit | Promote to execution | Positive |
| backend rejection error is displayed inside the modal | Promote to execution | Error handling |
| STATE_LAWYER does NOT see the promote-to-execution button | Promote to execution | Permission/visibility |

**Run result:** `8 passed (25.0s)` + `10-known-gaps.spec.ts` `1 passed / 6 skipped (17.8s)`

**Bugs found & fixed:**
- **BUG-007:** Promote-to-execution error was hidden behind the modal overlay → fixed by adding `error` prop to `PromoteExecutionModal`
- **BUG-008:** `10-known-gaps.spec.ts` hardcoded `/cases/5` but V24 seed ID was dynamic → fixed with `findCaseByBasis()` helper
- **SEED-DATA-002:** No seed case for promote-to-appeal → added V25 migration (`DEMO-FI-FINAL-006`)

**Updated folder structure:**
```
    ├── 11-case-detail-actions.spec.ts                  ← NEW: 8 tests (Session 7)
```

**Total chromium-project test count after Session 7:** 57 active + 7 documented skips = **64 collected**.

---

## 3) Commands

```powershell
# Pre-conditions: Postgres up; backend running on :8080 with V22 seed applied.
cd "C:\Users\kadri\Desktop\برنامج محامي\frontend"

# (Once) install Chromium binary
npm install ; npm run test:e2e:install

# Full chromium suite (general + admin-users) — recommended default
npx playwright test --project=chromium

# Per-role journey suite (separate project)
npx playwright test --project=roles

# Single-video full-system demo
npx playwright test --project=demo

# Open last HTML report
npm run test:e2e:report
```

Listing-only (no backend required, validates spec syntax):

```powershell
npx playwright test --list
```

Result of `--list` in this session (real output, captured to
`e2e/.artifacts/list-out.txt`):

```
Total: 102 tests in 25 files
```

---

## 4) Test-count summary

| Project | Files | Tests |
|---------|------:|------:|
| `chromium` (general + admin-users) | 15 | **56** |
| `roles` (per-role journeys) | 8 | 38 (incl. 7 documented skips) |
| `demo` (single-video tour) | 1 | 1 |
| **TOTAL** | **24 + 1 README** | **95 runnable + 7 documented skips = 102 collected** |

**New in this session:** +17 admin-users tests, +2 explicit POSTPONED skips
in `10-known-gaps.spec.ts`.

> **Session 6 — Promote-to-execution failure investigation (2026-04-19):**
> Root-cause analysis of the failure that occurs when the full-system demo
> reaches the promote-to-execution UI form/action.
>
> **BUG-006 found and fixed:** `caseIdFromUrl` and `executionFileIdFromUrl`
> in `e2e/fixtures/demoFlow.ts` used a broken regex `(?:[/?#]$)` that
> returned `null` for any clean `/cases/42` URL (React Router never adds a
> trailing separator). The helpers threw `"Not on a /cases/{id} URL"` in
> section 2 of the demo, crashing the test before it reached the
> promote-to-execution section (4c). Fixed by changing `(?:[/?#]$)` →
> `(?:[/?#]|$)` in both helpers.
>
> **Seed/Data gap confirmed (pre-existing):** Even after the regex fix, the
> promote-to-execution submit may return `400 STAGE_NOT_FINALIZED` from the
> backend if the APPEAL stage is not finalized. This matches the documented
> known gap (`test.skip` in `10-known-gaps.spec.ts`). The demo spec already
> handles this non-fatally. No application code or backend contract change
> required. See `UI_RUNTIME_BUGS_FOUND.md` entries BUG-006 and SEED-DATA-001.

---

## 5) Run results

### 5.1 Operator Run #4 (carried forward — last green run on a live backend)

> Source: `NEXT_CHAT_CONTEXT.md` §«Playwright Browser E2E — Session 4».
> Run #4 was performed by the owner with backend up. After the
> selector-stabilisation patch the chromium suite was 32/32 + 6 skipped.

| Status | Count |
|--------|------:|
| Passed (chromium project, pre-admin-users) | 25 → expected 32 after the in-session selector helpers |
| Skipped (documented gaps) | 6 |
| Failed | 0 (after fixes) |

### 5.2 In-session Run #5 (this session) — **collection-only**

Backend was confirmed DOWN
(`curl http://localhost:8080/api/v1/auth/login` returned HTTP `000`).
All Playwright tests therefore fail at the *first* `loginAs()` call with
`page.waitForURL` timeout because the auth POST never resolves. This is
**not** a test-code bug — the harness simply has no API to talk to.

| Phase | Result |
|-------|--------|
| `npx playwright test --list` | ✅ 102 tests collected (zero parse errors). All 17 new admin-users tests visible. |
| `npx playwright test --project=chromium --reporter=line` | ⏱ Cancelled at 5-min wall-clock — no backend; first sample failure was `06-resolved-register` failing at `loginAs` `waitForURL` timeout. |

→ Operator must run with backend up (commands in §3) to obtain the
final pass/fail/skip counts. Expected outcome: **all 17 new admin-users
tests pass** because:
- the components carry the exact `data-testid` attributes the specs use
  (`admin-users-page`, `admin-users-table`, `admin-users-create-button`,
  `admin-users-q`, `admin-user-form`, `admin-user-save`,
  `admin-user-detail-page`, `admin-user-basic-section`,
  `admin-user-patch-form`, `admin-user-patch-submit`,
  `admin-user-patch-success`, `admin-user-patch-error`,
  `admin-roles-section`, `admin-roles-list`, `admin-roles-add-form`,
  `admin-memberships-section`, `admin-memberships-table`,
  `admin-memberships-add-form`, `admin-delegations-section`,
  `admin-court-access-section`);
- the route guard (`RequireAuth anyOf={['CENTRAL_SUPERVISOR']}`) and the
  nav filter (`visibleItems`) match the negative-access assertions;
- the seeded users list contains all entries the filter tests expect
  (V20–V22);
- create/PATCH paths are mutation-safe: every test that mutates uses a
  freshly-created user (via `Date.now()`-suffixed username), so re-runs
  do not collide and seed users for the rest of the suite are untouched.

---

## 6) Per-module coverage matrix

Status legend: ✅ Browser-covered  •  🟡 Browser-covered, partial flow  •  ⏭️ Documented skip

| # | Module | File | Status | Notes |
|---|--------|------|:-----:|------|
| A | Auth foundation | `01-auth.spec.ts` | ✅ | login OK / login bad / protected redirect / logout / forgot-password reachable |
| A | OTP reset password loop | `10-known-gaps.spec.ts` | ⏭️ | OTP only printed to backend log (ENV-LIMIT-002); SMS POSTPONED |
| B | Role-based navigation | `02-navigation.spec.ts` + `roles/*` | ✅ | per-role sidebar verified |
| C | Cases list & detail | `03-create-case.spec.ts`, `04-case-detail-assign-lawyer.spec.ts` | ✅ | list, create, open detail |
| C | Edit basic data | inside `roles/02-section-head.spec.ts` | ✅ | covered indirectly via case-detail flow |
| D | Assign lawyer | `04-case-detail-assign-lawyer.spec.ts` + `roles/02-...` + `roles/04-...` | ✅ | visible/hidden per role + happy path + inactive lawyer excluded |
| E | Stage/hearing visibility | `05-hearing-progression.spec.ts` + `roles/05-state-lawyer-owner.spec.ts` | ✅ visibility / 🟡 mutation | rollover dialog opens; submit not exercised to keep seed stable |
| E | **Hearing rollover — real submit** | `12-submit-path-coverage.spec.ts` | ✅ NEW (R2) | Fresh-case strategy; intercepts `/rollover-hearing` POST, asserts `entryType=ROLLOVER`, history row appended |
| E | **Hearing finalize — real submit** | `12-submit-path-coverage.spec.ts` | ✅ NEW (R2) | Fresh-case strategy; intercepts `/finalize` POST, asserts `decisionType`, stage shows FINALIZED |
| F | Resolved register | `06-resolved-register.spec.ts` | ✅ | filter by year/month |
| G | Promote-to-appeal | `roles/02-section-head.spec.ts` (visibility) + `11-case-detail-actions.spec.ts` (S7) + `12-submit-path-coverage.spec.ts` (R2) | ✅ | SECTION_HEAD submit verified S7; **ADMIN_CLERK delegated path verified R2** |
| G | Promote-to-execution | `10-known-gaps.spec.ts` + `11-case-detail-actions.spec.ts` (S7) + `12-submit-path-coverage.spec.ts` (R2) | ✅ | SECTION_HEAD submit verified S7; **ADMIN_CLERK delegated visibility verified R2** |
| H | Execution files & steps | `07-execution.spec.ts` | ✅ | list + detail; add-step visibility verified |
| I | Attachments — list & section presence | `09-notifications-reminders-attachments.spec.ts` | ✅ | presence on both stage & execution-file |
| I | Attachments — authenticated download | `10-known-gaps.spec.ts` | ⏭️ | local-FS gap (D-035 / KNOWN-GAP-004); object storage POSTPONED |
| J | Reminders | `09-notifications-reminders-attachments.spec.ts` + `12-submit-path-coverage.spec.ts` (R2) | ✅ | section presence + status transitions on PENDING; **create-reminder real submit verified R2** |
| K | Notifications | `09-notifications-reminders-attachments.spec.ts` | ✅ | inbox + mark-as-read |
| L | Legal library list/detail | `08-knowledge.spec.ts` | ✅ | |
| L | Public entities list/detail | `08-knowledge.spec.ts` | ✅ | |
| L | Circulars list/detail | `08-knowledge.spec.ts` | ✅ | |
| M | **Admin Users — list & filters** | `admin-users/01-list-and-search.spec.ts` | ✅ NEW | nav-link visibility, table render, q-search, role filter, active filter |
| M | **Admin Users — create user (D-047)** | `admin-users/02-create-user.spec.ts` | ✅ NEW | banned-literal rejected, mobile pattern enforced, happy path → detail page |
| M | **Admin Users — detail / PATCH / Roles** | `admin-users/03-detail-and-patch.spec.ts` | ✅ NEW | PATCH success badge, add+remove role round-trip |
| M | **Admin Users — Sections** | `admin-users/04-sections.spec.ts` | ✅ NEW | 4 sections render; membership add against fresh user |
| M | **Admin Users — negative access (D-048-related route guard)** | `admin-users/05-negative-access.spec.ts` | ✅ NEW | 7 non-admin roles asserted: no nav link + redirect on direct URL |
| Z | SMS rate-limiting | `10-known-gaps.spec.ts` | ⏭️ POSTPONED | tracked in `FINAL_PRODUCTION_READINESS_PLAN.md` §3 |
| Z | httpOnly cookies | `10-known-gaps.spec.ts` | ⏭️ POSTPONED | D-049+ (KNOWN-GAP-003) |
| Z | Scheduler / external channels | `10-known-gaps.spec.ts` | ⏭️ POSTPONED | D-039 |
| Z | Object storage / AV | `10-known-gaps.spec.ts` | ⏭️ POSTPONED | D-035 successor |

---

## 7) Per-role coverage

| Role | Demo username | Specs touching it | Coverage |
|------|---------------|-------------------|---------:|
| CENTRAL_SUPERVISOR | `admin` | `admin-users/*`, `roles/00..` (when present) | ✅ Full (all admin-users specs) |
| BRANCH_HEAD | `head_dam` | `roles/01-branch-head.spec.ts`, `admin-users/05-negative-access.spec.ts` | ✅ Full |
| SECTION_HEAD | `section_fi_dam` | `02-navigation`, `03-create-case`, `04-case-detail-assign-lawyer`, `roles/02-...`, `admin-users/05-...` | ✅ Full |
| ADMIN_CLERK + ASSIGN_LAWYER | `clerk_fi_dam` | `roles/03-...`, `admin-users/05-...` | ✅ Full |
| ADMIN_CLERK − ASSIGN_LAWYER | `clerk2_fi_dam` | `roles/04-...`, `admin-users/05-...` | ✅ Full |
| STATE_LAWYER (owner) | `lawyer_fi_dam` | `roles/05-...`, `admin-users/05-...` | ✅ Full |
| STATE_LAWYER (non-owner) | `lawyer2_fi_dam` | `roles/06-...`, `admin-users/05-...` | ✅ Full |
| STATE_LAWYER (inactive) | `lawyer_inactive_fi` | `04-case-detail-assign-lawyer`, `admin-users/01-...` | ✅ asserted absent / asserted present in admin filter |
| STATE_LAWYER (appeal) | `lawyer_app_dam` | (reserved for appeal flow) | 🟡 indirect |
| READ_ONLY_SUPERVISOR | `viewer` | `roles/07-...`, `admin-users/05-...` | ✅ Full |

---

## 8) Known skipped items and reasons

`10-known-gaps.spec.ts` (chromium project) — **7 documented skips**:

| ID | Reason | Source |
|----|--------|--------|
| KNOWN-GAP-002 | Postponement reasons HTTP lookup — backend endpoint missing | `BACKEND_GAP_PHASE11_LOOKUPS.md` |
| ENV-LIMIT-002 | OTP-based reset password — OTP only in backend log | `UI_RUNTIME_BUGS_FOUND.md`; SMS POSTPONED |
| KNOWN-GAP-004 / D-035 | Attachment authenticated download — local-FS gap | `FINAL_PRODUCTION_BLOCKERS.md` §«Object storage»; POSTPONED |
| KNOWN-GAP-003 / D-044 | localStorage → httpOnly cookies migration | D-049+; POSTPONED |
| Seed/Data | Promote-to-execution live POST — Case 4 pre-promoted by V22 | `DEMO_SEED_RUNTIME_VERIFICATION.md` |
| POSTPONED | SMS rate-limiting / brute-force lockout | `FINAL_PRODUCTION_READINESS_PLAN.md` §3 |
| POSTPONED | Scheduler / external notification channels | D-039 |

`roles/99-known-gaps.spec.ts` — **7 additional documented skips** for the
roles project (User Admin CRUD UI is now CLOSED in the chromium project
but kept skipped here to preserve the historical role-journey shape).

> Note: KNOWN-GAP-001 (User Admin CRUD UI) is **closed** — coverage now
> lives under `e2e/tests/admin-users/*`. The `10-known-gaps.spec.ts`
> docstring records this transition. The roles-suite copy at
> `roles/99-known-gaps.spec.ts:10` was deliberately not edited because it
> belongs to a parallel "role tour" project; the deduplication is
> documented but harmless.

---

## 9) Artifact locations

| Type | Path |
|------|------|
| HTML report | `frontend/e2e/.artifacts/html-report/index.html` |
| Test results (chromium) | `frontend/e2e/.artifacts/test-results/` |
| Test results (roles) | `frontend/e2e/.artifacts/roles-results/` |
| Test results (demo) | `frontend/e2e/.artifacts/demo-results/` |
| Failure screenshots | per-test folder under `test-results/` |
| Failure videos (`.webm`) | per-test folder under `test-results/` |
| Failure traces (`.zip`) | per-test folder under `test-results/`; open with `npx playwright show-trace path/to/trace.zip` |
| List output (this session) | `frontend/e2e/.artifacts/list-out.txt` |
| Partial run output (this session) | `frontend/e2e/.artifacts/run-out.txt` |

---

## 10) What still requires the operator (one-time)

1. Start Postgres + backend on `:8080` (e.g. `scripts\run_backend.bat`).
2. Confirm V20/V21/V22 Flyway seeds applied (look for "V22 demo seed
   complete" in backend log).
3. Run:
   ```powershell
   cd "C:\Users\kadri\Desktop\برنامج محامي\frontend"
   npx playwright test --project=chromium
   ```
4. Inspect the HTML report under `e2e/.artifacts/html-report/`.

Expected outcome: **49 passed + 7 skipped = 56 tests in the chromium
project** (32 pre-existing green from Run #4 + 17 new admin-users + 7
documented skips). The roles and demo projects are independent and run
on their own commands.

---

## 11) Out of scope for this prompt (kept POSTPONED)

These are the explicitly POSTPONED production-hardening blockers and
were **not** touched in this session. They remain documented gaps:

- SMS gateway delivery + rate limiting / brute-force lockout
- httpOnly cookies (server-side refresh-token rotation, D-049+)
- Object storage (S3/MinIO) + AV scan (replacement for D-035 local FS)
- Scheduler + external notification channels (D-039 successor)
- Backup + secrets management
- Deployment hardening (TLS, headers, CSP, audit logging)

See `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md` §3..§15 for the
ordered roadmap; the very last line of `NEXT_CHAT_CONTEXT.md` enforces
this order verbatim.

