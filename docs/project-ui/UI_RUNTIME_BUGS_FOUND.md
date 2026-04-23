# UI_RUNTIME_BUGS_FOUND.md
## أخطاء وملاحظات مكتشفة أثناء Runtime E2E Audit

> **Date:** 2026-04-18
> **Audit type:** API-level runtime testing against live backend
>
> **Round 3 update (2026-04-20) — completion pass:**
> Added 12 more Playwright tests in `e2e/tests/13-completion-pass.spec.ts`
> closing the remaining medium-value gaps (reset-password, profile,
> attachment upload [stage + execution-file], add execution step,
> reminder status, notification mark-as-read). Full chromium project =
> **78 passed / 8 documented skips / 0 failed**. **Zero application bugs
> found. Zero application code changed.** Six small test-script-only
> issues fixed in-flight: button regex (actual text "إعادة التعيين"),
> profile heading vs. sidebar link strict-mode collision (use
> `getByRole('heading', …)`), backend response field
> `attachmentScopeType: 'CASE_STAGE'` not `'STAGE'`, execution-files
> endpoint returns a plain JSON array (not Spring page envelope), hidden
> file input cannot use `isVisible()` (gate on the visible "رفع مرفق"
> button instead), and a race condition where the clerk's add-step gate
> evaluates while `file` is still null (added explicit wait for "أفعال
> الملف"). Full report: `UI_PLAYWRIGHT_COMPLETION_PASS_ROUND_3.md`.

> **Round 2 update (2026-04-20) — submit-path coverage closure:**
> Added 10 new Playwright tests in
> `e2e/tests/12-submit-path-coverage.spec.ts` covering 4 high-value
> remaining gaps (rollover/finalize submit, ADMIN_CLERK delegated
> promote, reminder create). All 10 pass on a live backend; full chromium
> project = **66 passed / 8 documented skips / 0 failed**.
> **Zero application bugs found. Zero application code changed.** One
> non-bug environmental observation logged (STATE-DRIFT-001 below): the
> shared dev DB drifts after many test runs, so positive tests now create
> a fresh case per run via the API. Full report:
> `UI_PLAYWRIGHT_GAP_CLOSURE_ROUND_2.md`.
>
> **Session 3 status note (Browser E2E attempt, 2026-04-18):**
> Playwright suite **did not execute** in the agent — ENV-LIMIT-004
> re-confirmed (Arabic CWD + PowerShell 5.1 inside JetBrains agent =
> dead shell, zero stdout, zero filesystem side-effects). **No new bugs
> discovered. No fixes applied. No `test.skip` removed.** Statuses below
> remain exactly as left at the end of Session 2.
>
> **Session 4 update (Browser E2E real run, 2026-04-18):**
> Operator ran the full Playwright suite on their machine: **25 passed /
> 7 failed / 6 skipped**. All 7 failures were **test-code selector/timing
> issues** (not application bugs). Fixed in-session in the spec files.
> **Zero application bugs discovered from the real browser run.**
> Bug statuses below remain unchanged. No new BUG-00X entries added.
>
> **Session 6 update (Promote-to-execution failure investigation, 2026-04-19):**
> Investigated the exact root cause of the Playwright failure at the
> **promote-to-execution** form/action in `00-full-system-demo.spec.ts`.
>
> **Finding 1 — BUG-006 (Playwright Test Bug, FIXED in-session):**
> `caseIdFromUrl` and `executionFileIdFromUrl` in `e2e/fixtures/demoFlow.ts`
> contained a broken regex `/\/cases\/(\d+)(?:[/?#]$)/`. The `(?:[/?#]$)`
> group requires a trailing `/?#` character at the end of the URL, which
> React Router never appends. For a clean URL like `/cases/42`, the regex
> returns `null` and the helper throws `"Not on a /cases/{id} URL"` — before
> the demo test ever reaches section 4c (promote-to-execution). Fixed by
> changing `(?:[/?#]$)` → `(?:[/?#]|$)` in both helpers.
>
> **Finding 2 — Documented Seed/Data Gap (already known, unchanged):**
> The promote-to-execution SUBMIT in section 4c of the demo test may receive
> a `400 STAGE_NOT_FINALIZED` from the backend if the APPEAL stage was not
> successfully finalized in section 4b. This is not a new bug — it is the
> pre-existing seed/data gap documented in `10-known-gaps.spec.ts` and the
> README §8 table: _"Case 4 pre-promoted by V22 seed; no fresh promotable
> case."_ The demo test already handles this non-fatally via `.catch()` +
> `dismissModalIfAny`. No backend or business-rule change is needed.
>
> **Session 5 update (Full browser-coverage expansion, 2026-04-19):**
> Added **17 new Playwright tests** under `frontend/e2e/tests/admin-users/`
> covering UI sub-phase B end-to-end:
> list+filters (4), create-user with D-047 banned-literal + mobile
> validation (3), detail+PATCH+role round-trip (1), 4-section render +
> membership add (2), and 7 negative-access role iterations.
> Updated `10-known-gaps.spec.ts`: removed the obsolete
> *KNOWN-GAP-001 (User Admin CRUD UI)* skip and added 2 explicit
> POSTPONED skips (SMS rate-limiting; Scheduler/external channels).
> **Backend was DOWN during this session** (`curl :8080` → `000`), so the
> chromium project was only validated at the *collection* level
> (`npx playwright test --list` → 102 tests, all 17 new admin-users
> tests visible — zero parse errors). **No new bugs found. No
> application code changed. No backend code changed.** Run-time numbers
> from Run #4 carry forward; Run #5 (post-admin-users) is pending the
> operator. Full report: `UI_PLAYWRIGHT_FULL_COVERAGE_REPORT.md`.
>
> **Session 2 reconciliation (2026-04-18, post-V22) — status legend:**
> - **open** — not yet fixed (BUG-001, BUG-005)
> - **out of scope by design** — informational only, not a real bug (BUG-002)
> - **fixed in-session (Session 1)** — source-code fix applied (BUG-004)
> - **closed by seed** — fixed by a seed/migration patch (BUG-003 ⇐ V22)
> - **known gap** — pre-existing documented production gap (KNOWN-GAP-*)
> - **environment limitation** — cannot be reproduced/tested in agent env (ENV-LIMIT-*)
>
> Session 2 found **no new bugs**. Counts after V22:
> - 2 open (LOW cosmetic): BUG-001, BUG-005
> - 1 out-of-scope: BUG-002
> - 1 fixed in-session: BUG-004
> - **1 closed by seed: BUG-003** ✅
> - 4 known gaps: KNOWN-GAP-001..004 (unchanged)
> - 4 environment limits: ENV-LIMIT-001..004 (ENV-LIMIT-004 confirmed again
>   — terminal output completely silent with Arabic CWD)

---

## BUG-001 — Unauthenticated `/users/me` returns empty body instead of JSON 401

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-001 |
| **Title** | GET /users/me without token returns empty body |
| **Classification** | Runtime Bug |
| **Severity** | LOW |
| **Repro Steps** | `curl -s http://localhost:8080/api/v1/users/me` |
| **Expected** | HTTP 401 with JSON body `{"code":"UNAUTHORIZED","message":"..."}` |
| **Actual** | HTTP 401 with empty body |
| **Layer** | Backend (Spring Security filter chain) |
| **Status** | Open |
| **Notes** | الـ frontend يتعامل مع 401 status code مباشرة عبر axios interceptor، لذا لا تأثير وظيفي. لكن الـ API يجب أن يرجع JSON متسق. |

---

## BUG-002 — `UpdateBasicDataRequest` does not have a `subject` field

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-002 |
| **Title** | PUT /cases/{id}/basic-data accepts unknown field `subject` silently |
| **Classification** | Runtime Bug (cosmetic — Jackson ignores unknown) |
| **Severity** | LOW |
| **Repro Steps** | `PUT /cases/2/basic-data` with `{"subject":"..."}` |
| **Expected** | Either error (unknown field) or actual update |
| **Actual** | Returns 200 OK, `updatedAt` changes but no actual field updated — Jackson silently ignores unknown properties |
| **Layer** | Backend — not really a bug, just Jackson's default `FAIL_ON_UNKNOWN_PROPERTIES=false` behavior |
| **Status** | Open — cosmetic, no functional impact |
| **Notes** | الـ frontend يُرسل الحقول الصحيحة (`publicEntityName`, `opponentName`, etc.) — هذا فقط ملاحظة على الـ API contract. |

---

## BUG-003 — Seed data V20/V21 missing `user_court_access` for test lawyers

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-003 |
| **Title** | Cannot assign lawyer — "Lawyer has no active access to the case court" |
| **Classification** | Runtime Bug (Seed Data Gap) |
| **Severity** | **HIGH** |
| **Repro Steps** | 1) Login as section_fi_dam 2) Create case with courtId=2 3) POST /cases/{id}/assign-lawyer with lawyerUserId=5 |
| **Expected** | Lawyer assigned successfully |
| **Actual** | `{"code":"FORBIDDEN","message":"Lawyer has no active access to the case court"}` |
| **Layer** | Data (seed scripts V20/V21) |
| **Status** | **✅ CLOSED — fixed by V22__demo_seed_data.sql** |
| **Notes** | الـ backend يتحقق من `user_court_access` عند الإسناد. الـ seed scripts V20/V21 كانت تُنشئ `user_department_memberships` لكن **لا تُنشئ `user_court_access`**. أُصلح في V22 بإضافة court access لـ lawyer_fi_dam + lawyer2_fi_dam + lawyer_app_dam. |
| **Fix** | `V22__demo_seed_data.sql` — `INSERT INTO user_court_access` لكل محامي تجريبي. **تم التحقق runtime: assign-lawyer ينجح الآن.** |

---

## BUG-004 — Build failure: `UserQueryService.java` orphaned code outside class

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-004 |
| **Title** | UserQueryService.java has duplicate method body outside class braces |
| **Classification** | Runtime Bug |
| **Severity** | **CRITICAL** (blocks build) |
| **Repro Steps** | `mvn clean package` |
| **Expected** | BUILD SUCCESS |
| **Actual** | Compilation error: "Unnamed classes are a preview feature" at line 154 |
| **Layer** | Backend (source code) |
| **Status** | **Fixed in-session** — removed orphaned lines 154–185 |
| **Notes** | كود مكرر من `getCurrentUser()` كان ملتصقًا بعد إغلاق الـ class. أُزيل أثناء الاختبار. |

---

## BUG-005 — `GET /api/v1/legal-library` (no sub-path) returns 500 INTERNAL_ERROR

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-005 |
| **Title** | Hitting /legal-library without /items or /categories returns 500 |
| **Classification** | Runtime Bug |
| **Severity** | LOW |
| **Repro Steps** | `curl -s -H "Authorization: Bearer TOKEN" http://localhost:8080/api/v1/legal-library` |
| **Expected** | 404 Not Found (no endpoint mapped) |
| **Actual** | `{"code":"INTERNAL_ERROR","message":"Unexpected error"}` |
| **Layer** | Backend (Spring MVC mapping + error handler) |
| **Status** | Open |
| **Notes** | الـ frontend لا يضرب هذا الـ path — يستخدم `/legal-library/categories` و `/legal-library/items`. لا تأثير وظيفي. الـ 500 بدل 404 يعني أن الـ global error handler يلتقط NoHandlerFoundException كـ 500. |

---

## KNOWN-GAP-001 — User Admin CRUD غير موجود

| الحقل | القيمة |
|------|--------|
| **ID** | KNOWN-GAP-001 |
| **Classification** | Known Documented Gap |
| **Severity** | CRITICAL (for production) |
| **Reference** | `FINAL_PRODUCTION_BLOCKERS.md` §2 |
| **Status** | Documented — mini-phase B |

---

## KNOWN-GAP-002 — Postponement Reasons HTTP Lookup غير موجود

| الحقل | القيمة |
|------|--------|
| **ID** | KNOWN-GAP-002 |
| **Classification** | Known Documented Gap |
| **Severity** | LOW |
| **Reference** | `FINAL_PRODUCTION_BLOCKERS.md` §3, D-020 |
| **Status** | Documented |

---

## KNOWN-GAP-003 — localStorage token storage (D-044)

| الحقل | القيمة |
|------|--------|
| **ID** | KNOWN-GAP-003 |
| **Classification** | Known Documented Gap |
| **Severity** | MEDIUM |
| **Reference** | `FINAL_PRODUCTION_BLOCKERS.md` §4 |
| **Status** | Documented |

---

## KNOWN-GAP-004 — Local filesystem attachments (D-035)

| الحقل | القيمة |
|------|--------|
| **ID** | KNOWN-GAP-004 |
| **Classification** | Known Documented Gap |
| **Severity** | HIGH (for production) |
| **Reference** | `FINAL_PRODUCTION_BLOCKERS.md` §5 |
| **Status** | Documented |

---

## ENV-LIMIT-001 — No browser automation available

| الحقل | القيمة |
|------|--------|
| **ID** | ENV-LIMIT-001 |
| **Classification** | Environment Limitation |
| **Notes** | الـ agent environment لا يدعم Playwright/Puppeteer/DevTools. كل الاختبارات API-level عبر curl. |

---

## ENV-LIMIT-002 — OTP reset password flow not testable programmatically

| الحقل | القيمة |
|------|--------|
| **ID** | ENV-LIMIT-002 |
| **Classification** | Environment Limitation |
| **Notes** | الـ forgot-password يعمل ويُنشئ OTP في الـ logs. لكن reset-password يحتاج OTP كمدخل + الـ OTP قصير العمر. |

---

## ENV-LIMIT-003 — Attachment download requires browser blob support

| الحقل | القيمة |
|------|--------|
| **ID** | ENV-LIMIT-003 |
| **Classification** | Environment Limitation |

---

## ENV-LIMIT-004 — Terminal foreground output broken with Arabic workspace path

| الحقل | القيمة |
|------|--------|
| **ID** | ENV-LIMIT-004 |
| **Classification** | Environment Limitation |
| **Notes** | PowerShell foreground terminal لا يُظهر output في IDE agent مع مسار عربي. الحل: استخدام background terminals + file redirect + read_file. |

---

## BUG-006 — `caseIdFromUrl` / `executionFileIdFromUrl` broken regex in demoFlow.ts

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-006 |
| **Title** | `caseIdFromUrl` and `executionFileIdFromUrl` use broken regex — throws for clean `/cases/{id}` URLs |
| **Classification** | Playwright Test Bug |
| **Severity** | HIGH — causes `00-full-system-demo.spec.ts` to crash in section 2 before reaching section 4c (promote-to-execution) |
| **Repro Steps** | Run `00-full-system-demo.spec.ts`; after case creation the URL resolves to `/cases/42` (no trailing slash); `caseIdFromUrl(page)` calls `page.url().match(/\/cases\/(\d+)(?:[/?#]$)/)` which returns `null` because `(?:[/?#]$)` requires a trailing `/?#` char; function throws `"Not on a /cases/{id} URL: http://localhost:5173/cases/42"` |
| **Expected** | `caseIdFromUrl` extracts `42` from `http://localhost:5173/cases/42` |
| **Actual** | `null` match → throws → demo test fails at section 2, never reaches section 4c (promote-to-execution) |
| **Root Cause** | Regex `(?:[/?#]$)` is `[/?#]` THEN `$` (end-of-string) — it requires one trailing separator character before end. React Router never appends a trailing `/`. Correct pattern is `(?:[/?#]\|$)` (either a separator OR end-of-string). |
| **Affected Files** | `frontend/e2e/fixtures/demoFlow.ts` — both `caseIdFromUrl` and `executionFileIdFromUrl` |
| **Fix** | Changed `(?:[/?#]$)` → `(?:[/?#]\|$)` in both helpers |
| **Status** | **✅ Fixed in-session (Session 6)** |

---

## SEED-DATA-001 — Promote-to-execution live POST blocked by V22 seed (Case 4 pre-promoted)

| الحقل | القيمة |
|------|--------|
| **ID** | SEED-DATA-001 |
| **Title** | No fresh promotable case available for promote-to-execution end-to-end test |
| **Classification** | Seed/Data Problem (pre-existing documented gap) |
| **Severity** | LOW — covered by `test.skip` in `10-known-gaps.spec.ts`; demo test handles it non-fatally |
| **Root Cause** | V22 seed pre-promotes Case 4 to execution status. The seeded data has no case in state `ACTIVE`/`IN_APPEAL` with a `FINALIZED` current stage that has not yet been promoted. The full-system demo creates a fresh case and tries to walk it through the lifecycle, but if the APPEAL stage finalization fails (owner mismatch between FI lawyer and APPEAL department), the backend rejects promote-to-execution with `400 STAGE_NOT_FINALIZED`. |
| **Backend error returned** | `400 Bad Request` — `{"code":"STAGE_NOT_FINALIZED","message":"Current stage must be FINALIZED before promoting to execution"}` |
| **Expected vs Actual** | Expected: navigation to `/execution-files/{id}`. Actual: modal stays open with backend error message; `.catch()` in demo spec logs a NOTE and calls `dismissModalIfAny` — non-fatal. |
| **Status** | **Known Gap — test.skip in `10-known-gaps.spec.ts` and `roles/99-known-gaps.spec.ts`** |
| **Reference** | README `e2e/README.md` §8; `10-known-gaps.spec.ts` line 37 |
| **Next action** | Requires a dedicated Flyway seed migration that provides a case with a FINALIZED APPEAL stage ready for promotion — no backend contract change needed, purely a seed/data addition. |

---

## BUG-007 — Promote-to-execution error displayed behind modal (not visible)

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-007 |
| **Title** | Promote-to-execution backend error shown in page-level banner behind the open modal |
| **Classification** | Runtime Bug |
| **Severity** | MEDIUM — user sees no feedback on failure while the modal is open |
| **Repro Steps** | 1) Login as SECTION_HEAD 2) Open case that is NOT promotable (e.g. stage not FINALIZED) 3) Click "ترقية إلى التنفيذ" 4) Fill form and submit 5) Backend returns 400 — error banner renders behind modal overlay |
| **Expected** | Error message shown inside the modal |
| **Actual** | Error set in `actionError` state, rendered in page-level alert div — hidden behind the modal overlay |
| **Root Cause** | `promoteExecMut.onError` wrote to page-level `actionError` instead of passing the error into the modal component |
| **Fix** | Added `error` prop to `PromoteExecutionModal`, rendered `[role="alert"]` inside the modal body. Removed page-level `actionError` write from `promoteExecMut.onError`. |
| **Affected Files** | `frontend/src/features/cases/CaseDetailPage.tsx` |
| **Status** | **✅ Fixed in-session (Session 7)** |

---

## BUG-008 — `10-known-gaps.spec.ts` hardcodes `/cases/5` but V24 seed ID is dynamic

| الحقل | القيمة |
|------|--------|
| **ID** | BUG-008 |
| **Title** | Promote-to-execution Playwright test hardcodes `/cases/5` — V24 seed case ID varies by DB sequence |
| **Classification** | Playwright Test Bug |
| **Severity** | HIGH — test passes only if Case 5 happens to be the V24 seed; fails on any DB with extra cases |
| **Repro Steps** | Run `10-known-gaps.spec.ts` on a DB where V24 seed (DEMO-APPEAL-FINAL-005) was assigned id≠5 |
| **Expected** | Test finds the correct case regardless of its auto-generated ID |
| **Actual** | Test navigates to `/cases/5` which is a different case (DEMO-FINAL-003, lifecycle=IN_APPEAL but appeal stage REGISTERED, not FINALIZED) |
| **Root Cause** | Hardcoded `/cases/5` assumed V24 seed would always be assigned id=5 |
| **Fix** | Added `findCaseByBasis()` helper that queries the backend API by `originalBasisNumber = 'DEMO-APPEAL-FINAL-005'` to find the correct case ID dynamically. |
| **Affected Files** | `frontend/e2e/tests/10-known-gaps.spec.ts` |
| **Status** | **✅ Fixed in-session (Session 7)** |

---

## SEED-DATA-002 — No seed case for promote-to-appeal positive E2E test

| الحقل | القيمة |
|------|--------|
| **ID** | SEED-DATA-002 |
| **Title** | No case existed with lifecycle=ACTIVE + FI stage FINALIZED for promote-to-appeal E2E |
| **Classification** | Seed/Data Problem |
| **Severity** | MEDIUM — blocked promote-to-appeal positive Playwright test |
| **Root Cause** | V20-V24 seeds had no case in ACTIVE lifecycle with a FINALIZED FIRST_INSTANCE stage (Case 5/DEMO-FINAL-003 was already promoted to appeal by a previous test run or seed) |
| **Fix** | Added `V25__seed_case_fi_finalized_for_promote_to_appeal.sql` creating case DEMO-FI-FINAL-006 with lifecycle=ACTIVE, FI stage=FINALIZED, is_read_only=FALSE |
| **Affected Files** | `backend/src/main/resources/db/migration/V25__seed_case_fi_finalized_for_promote_to_appeal.sql` |
| **Status** | **✅ Fixed in-session (Session 7)** |
---
## STATE-DRIFT-001 — Shared dev DB drifts after long Playwright runs (environmental, not a bug)
| الحقل | القيمة |
|------|--------|
| **ID** | STATE-DRIFT-001 |
| **Title** | Case 2 ownership no longer matches V22 seed assumption after dozens of prior test runs |
| **Classification** | Environmental observation (NOT a bug) |
| **Severity** | LOW |
| **Repro Steps** | After many chromium runs, query Case 2: currentOwnerUserId is no longer lawyer_fi_dam (id=5). |
| **Expected** | Either Case 2 stays at the V22 seed state, or specs that rely on it create a fresh case. |
| **Actual** | Case 2's owner has drifted; lawyer_fi_dam gets HTTP 403 on GET /cases/2 and on POST /cases/2/reminders. |
| **Layer** | Test environment (shared dev DB) |
| **Status** | **Worked around in tests (2026-04-20)** — 12-submit-path-coverage.spec.ts creates a fresh case per positive test via the API and assigns the lawyer at runtime, eliminating reliance on Case 2's seed-time ownership. No application change. |
| **Notes** | The seed itself is correct; this is a normal consequence of running mutation-heavy tests against a long-lived dev DB. CI / fresh DB runs would not see this. Documented so future contributors do not waste time investigating what is not a bug. |
