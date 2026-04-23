# UI_ROLE_RUNTIME_MATRIX_E2E.md
## مصفوفة الأدوار الفعلية — Runtime E2E Audit

> **Date:** 2026-04-18  
> **Method:** API-level testing against live backend
>
> **Session 3 status note (Browser E2E attempt, 2026-04-18):**
> Playwright suite includes per-role browser checks (sidebar visibility,
> create-case gate page for viewer/lawyer, assign-lawyer section visibility
> for section vs lawyer vs viewer, owner-only rollover/finalize buttons),
> but **was not executed in this agent session** (ENV-LIMIT-004). All
> per-role assertions in the table below remain **API-level verified only**.
> Browser-level role visibility audit is pending the operator-side run —
> see `UI_BROWSER_E2E_AUDIT.md` §5.
>
> **Session 4 update (Browser E2E real run, 2026-04-18):**
> Operator ran Playwright on their machine. The following role assertions
> **now confirmed at the real-browser level**:
> - SECTION_HEAD: sees sidebar, creates case, sees assign-lawyer section,
>   does NOT see owner-only rollover/finalize ✅
> - STATE_LAWYER (owner): sees sidebar, sees cases, sees rollover/finalize,
>   does NOT see assign-lawyer section ✅
> - STATE_LAWYER (non-owner): correctly scoped — cannot see unowned cases ✅
> - READ_ONLY_SUPERVISOR: sees sidebar+cases, blocked from create-case,
>   does NOT see assign-lawyer section ✅
> - All 25 browser-passing tests exercised role-gated UI correctly.
> - 7 test failures were selector/timing issues (not role bugs), fixed.
>
> **Session 5 update (Admin Users browser coverage, 2026-04-19):**
> The following role assertions are now **specified** at the browser level
> - **CENTRAL_SUPERVISOR (`admin`)**: sees `إدارة المستخدمين` sidebar
>   entry, reaches `/admin/users`, sees the users table, can search /
>   filter / paginate, can create users (D-047 client-side validation
>   enforced), can PATCH basic fields, can add+remove roles, can add
>   memberships → all 17 admin-users specs.
> - **All 7 non-admin roles** (BRANCH_HEAD, SECTION_HEAD,
>   ADMIN_CLERK±ASSIGN_LAWYER, STATE_LAWYER owner & non-owner, viewer):
>   `إدارة المستخدمين` sidebar entry MUST NOT render; direct nav to
>   `/admin/users` MUST redirect to `/dashboard` (RequireAuth guard) →
>   `admin-users/05-negative-access.spec.ts`.
> - SMS rate-limiting + Scheduler/external channels remain explicit
>   `test.skip` entries (POSTPONED).
> Zero application changes. Zero new bugs. Source: `UI_PLAYWRIGHT_FULL_COVERAGE_REPORT.md`.
>
> **Session 2 reconciliation (2026-04-18, post-V22):**
> - الجدول أدناه يعكس Session 1 (pre-V22).
> - **بعد V22:** السطر الأهم الذي تغيّر = SECTION_HEAD `POST assign-lawyer`
>   انتقل من ❌ (BUG-003) إلى ✅ PASS — تم التحقق runtime عبر
>   `DEMO_SEED_RUNTIME_VERIFICATION.md` (case 1 → owner=5 → status=ASSIGNED).
> - أيضًا STATE_LAWYER (`lawyer_fi_dam`) يعرض الآن **4 قضايا مُسندة** بدلًا
>   من `[]`، ويُمكنه فعليًا rollover/finalize على المرحلة (entry id=12 +
>   decision D-V22-TEST).
> - **لا تغييرات أخرى** على الأدوار. كل قرارات الصلاحية الموثَّقة في §1..§6
>   لا تزال صحيحة. لا runtime جديد في Session 2 (ENV-LIMIT-004).

> **Round 3 update (2026-04-20) — Completion pass:**
> 12 additional browser tests in `e2e/tests/13-completion-pass.spec.ts`
> add per-role real-submit coverage for the remaining medium-value
> flows (full chromium project: 78 passed / 8 documented skips / 0
> failed). New per-role browser-verified actions:
> - **STATE_LAWYER (owner — `lawyer_fi_dam`)**: reset-password page +
>   profile page render; **stage attachment upload (real multipart
>   POST)**; **execution-file attachment upload (assignee path, real
>   POST)**; **reminder status PENDING → DONE (real PATCH)**.
> - **ADMIN_CLERK with delegations (`clerk_fi_dam`)**: **add execution
>   step (real submit, ADD_EXECUTION_STEP delegation)**;
>   **execution-file attachment upload (real POST)**.
> - **SECTION_HEAD (`section_fi_dam`)**: **notification mark-as-read
>   (real PATCH)**; profile page render.
> - **STATE_LAWYER (non-owner — `lawyer2_fi_dam`)**: add-execution-step
>   button confirmed absent on a file owned by another lawyer
>   (negative gating).
> Source: `UI_PLAYWRIGHT_COMPLETION_PASS_ROUND_3.md`.

> **Round 2 update (2026-04-20) — Submit-path closure:**
> Three additional per-role assertions are now **browser-verified at the
> real-submit level** via `e2e/tests/12-submit-path-coverage.spec.ts`
> (10 new tests, all pass on a live backend; full chromium project =
> 66/0/8):
> - **STATE_LAWYER (owner — `lawyer_fi_dam`)**: rollover hearing **submit**
>   succeeds (intercepted `/rollover-hearing` POST, history row appended);
>   finalize stage **submit** succeeds (intercepted `/finalize` POST,
>   stage shows FINALIZED); create-reminder **submit** succeeds
>   (intercepted `/reminders` POST, list refreshes).
> - **STATE_LAWYER (non-owner — `lawyer2_fi_dam`)**: rollover and
>   finalize buttons confirmed absent on a stage owned by another lawyer.
> - **ADMIN_CLERK with delegations (`clerk_fi_dam`)**: promote-to-appeal
>   button visible AND submit successful on V25 case
>   (DEMO-FI-FINAL-006); promote-to-execution button visible on V24 case
>   (DEMO-APPEAL-FINAL-005). Previously this delegation gate was
>   API-only verified.
> - **STATE_LAWYER + READ_ONLY_SUPERVISOR**: promote buttons confirmed
>   absent (negative gating).
> Zero application changes. Zero new bugs. Source:
> `UI_PLAYWRIGHT_GAP_CLOSURE_ROUND_2.md`.

---

## 1) CENTRAL_SUPERVISOR (`admin`)

| الميزة | نتيجة API | ملاحظات |
|--------|----------|---------|
| Login | ✅ | roles: ["CENTRAL_SUPERVISOR"] |
| /users/me | ✅ | no memberships, no delegations |
| GET /cases | ✅ يرى كل الدعاوى | 1 case returned |
| GET /notifications | ✅ `[]` | لا إشعارات — طبيعي (ليس section head) |
| GET /legal-library/* | ✅ | — |
| GET /public-entities | ✅ | — |
| GET /circulars | ✅ | — |
| **Frontend nav expected** | Dashboard, Cases, Resolved Register, Execution Files, Notifications, Knowledge (3 pages), Profile | — |
| **Runtime nav** | 🚫 Not tested (no browser) | — |

---

## 2) BRANCH_HEAD (`head_dam`)

| الميزة | نتيجة API | ملاحظات |
|--------|----------|---------|
| Login | ✅ | roles: ["BRANCH_HEAD"] |
| /users/me | ✅ | branchId=1, no departmentId |
| GET /cases | ✅ يرى دعاوى فرع دمشق | 1 case |
| **Expected visibility** | Read-only across branch — no create/edit/assign | — |
| **Runtime nav** | 🚫 Not tested (no browser) | — |

---

## 3) SECTION_HEAD (`section_fi_dam`)

| الميزة | نتيجة API | ملاحظات |
|--------|----------|---------|
| Login | ✅ | roles: ["SECTION_HEAD"], dept=2 (FIRST_INSTANCE) |
| GET /cases | ✅ يرى دعاوى قسمه | — |
| POST /cases | ✅ ينشئ | — |
| PUT /cases/{id}/basic-data | ✅ يعدّل | — |
| GET /users (assignable) | ✅ يرى المحامين | branchId=1, departmentId=2 |
| POST /cases/{id}/assign-lawyer | ❌ court access issue | BUG-003 |
| GET /notifications | ✅ CASE_REGISTERED | — |
| PATCH /notifications/{id}/read | ✅ | — |
| POST /stages/{id}/attachments | ✅ upload | — |
| **Expected actions** | Create, Edit, Assign, Promote, Read all in dept | Most work ✅ except assign (BUG-003) |

---

## 4) ADMIN_CLERK (`clerk_fi_dam`)

| الميزة | نتيجة API | ملاحظات |
|--------|----------|---------|
| Login | ✅ | roles: ["ADMIN_CLERK"] |
| /users/me | ✅ | 9 delegated permissions including ASSIGN_LAWYER |
| GET /cases | ✅ يرى دعاوى قسمه | — |
| GET /users (assignable) | ✅ يرى المحامين (has ASSIGN_LAWYER) | — |
| **Expected actions** | Depends on delegations — all 9 granted to this user | — |

### clerk2_fi_dam (no ASSIGN_LAWYER)

| الميزة | نتيجة API | ملاحظات |
|--------|----------|---------|
| Login | ✅ | — |
| GET /users (assignable) | ❌ **FORBIDDEN** | **Expected? Needs investigation** |

**ملاحظة:** clerk2_fi_dam doesn't have ASSIGN_LAWYER delegation. The endpoint returned FORBIDDEN which is **correct per D-046 authorization rules** — only SECTION_HEAD or ADMIN_CLERK+ASSIGN_LAWYER can list. ✅ This is correct behavior.

---

## 5) STATE_LAWYER (`lawyer_fi_dam`)

| الميزة | نتيجة API | ملاحظات |
|--------|----------|---------|
| Login | ✅ | roles: ["STATE_LAWYER"] |
| GET /cases | ✅ `[]` فارغ | لا دعاوى مُسندة — طبيعي (BUG-003 يمنع الإسناد) |
| POST /cases | ❌ FORBIDDEN | ✅ صحيح — lawyer لا ينشئ |
| PUT /cases/{id}/basic-data | ❌ FORBIDDEN | ✅ صحيح |
| GET /users (assignable) | ❌ FORBIDDEN | ✅ صحيح |
| GET /stages/{id}/progression | ❌ FORBIDDEN (no case assigned) | ⏭️ blocked by BUG-003 |
| **Expected actions** | Rollover, Finalize (own cases only) | Cannot verify — no cases assigned |

---

## 6) READ_ONLY_SUPERVISOR (`viewer`)

| الميزة | نتيجة API | ملاحظات |
|--------|----------|---------|
| Login | ✅ | roles: ["READ_ONLY_SUPERVISOR"] |
| GET /cases | ✅ يرى كل الدعاوى | — |
| POST /cases | ❌ FORBIDDEN | ✅ صحيح |
| GET /users (assignable) | ❌ FORBIDDEN | ✅ صحيح |
| **Expected actions** | Read-only everywhere | ✅ Confirmed |

---

## 7) Authorization Summary Matrix

| Action | CENTRAL_SUPERVISOR | BRANCH_HEAD | SECTION_HEAD | ADMIN_CLERK (+ASSIGN) | ADMIN_CLERK (-ASSIGN) | STATE_LAWYER | READ_ONLY |
|--------|-------------------|-------------|--------------|----------------------|----------------------|-------------|-----------|
| GET /cases | ✅ all | ✅ branch | ✅ dept | ✅ dept | ✅ dept | ✅ own only | ✅ all |
| POST /cases | NT | NT | ✅ | NT | NT | ❌ ✅ | ❌ ✅ |
| PUT basic-data | NT | NT | ✅ | NT | NT | ❌ ✅ | NT |
| GET /users (assign) | NT | NT | ✅ | ✅ | ❌ ✅ | ❌ ✅ | ❌ ✅ |
| POST assign-lawyer | NT | NT | ❌ BUG-003 | NT | NT | NT | NT |
| Upload attachment | NT | NT | ✅ | NT | NT | NT | NT |
| GET notifications | ✅ | NT | ✅ | NT | NT | ✅ | NT |
| Mark notification read | NT | NT | ✅ | NT | NT | NT | NT |

**Legend:** ✅ = works as expected, ❌ ✅ = correctly denied, ❌ = fails unexpectedly, NT = not tested, BUG-003 = blocked by seed data

---

## 8) Runtime Mismatches Found

| Mismatch | Details | Severity |
|----------|---------|----------|
| clerk2_fi_dam FORBIDDEN on /users | ✅ **Correct** — no ASSIGN_LAWYER delegation | Not a bug |
| lawyer sees 0 cases | ✅ **Correct** — no cases assigned to this lawyer | Not a bug (blocked by BUG-003) |
| Viewer can read all cases | ✅ **Correct** per READ_ONLY_SUPERVISOR scope | Not a bug |

**No role/visibility bugs found.** All authorization decisions match documented requirements.
