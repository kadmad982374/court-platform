# UI PHASE STATUS

## آخر مرحلة UI مكتملة
> هذه الوثيقة تعكس حالة الواجهة الأمامية الحالية.
>
> **Final Closure Phase أُنجزت + Mini-Phase A (Assign Lawyer) أُنجزت** —
> انظر `docs/project/FINAL_PROJECT_CLOSURE_REPORT.md` + ملفات `FINAL_*`
> الأخرى + قسم D-046 في
> `docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md`. لا توجد UI phase
> queued تلقائيًا.

---

## Current UI phase
**Phase 11 — Admin screens + final readiness — followed by Mini-Phase A
(AssignLawyerSection in `CaseDetailPage`).**

## Status
**Completed**

## Completed in this phase (incremental over Phase 10)

1. **Create-case UI — fully bound (Phase 11)**
   - `CreateCasePage` at `/cases/new`.
   - `POST /api/v1/cases` (existing — Phase 2).
   - Lookups consumed: `GET /branches`, `GET /branches/{id}/departments`,
     `GET /courts?branchId=…&departmentType=…`.
   - Branches/departments dropdowns filtered to the user's own active
     SECTION_HEAD/ADMIN_CLERK memberships (visual-only; backend D-004
     authoritative).
   - Courts filtered by branchId + the chosen stage's department type, so
     `OrganizationService.validateConsistency` cannot fail.
   - First-postponement-reason kept as **free text** per **D-020** (no
     `GET /postponement-reasons` HTTP endpoint exists; documented as a
     conservative gap, not a decision change).
   - Entry-point button "+ إنشاء دعوى" added in `CasesListPage` header,
     gated by `canCreateCase(user)`.

2. **Edit-basic-data UI — fully bound (Phase 11)**
   - `EditCaseBasicDataModal` mounted inside `CaseDetailPage`.
   - `PUT /api/v1/cases/{id}/basic-data` (existing — Phase 2).
   - Sends only changed fields (diff strategy) — matches backend
     `Optional` semantics in `UpdateBasicDataRequest`.
   - Excludes by design: `originalRegistrationDate` (D-006), ownership,
     stage status, branchId, departmentId.
   - Court dropdown filtered by case's branch + current stage's type.
   - Entry button shown only if `canEditCaseBasicData(user, case)` is true.

3. **Forgot-password UI — fully bound (Phase 11)**
   - `ForgotPasswordPage` at `/forgot-password` (public).
   - `POST /api/v1/auth/forgot-password` (existing — Phase 1).
   - Neutral confirmation per **D-013** (no enumeration leak).
   - Continue-button forwards `mobileNumber` via `location.state` to
     reset page.

4. **Reset-password UI — fully bound (Phase 11)**
   - `ResetPasswordPage` at `/reset-password` (public).
   - `POST /api/v1/auth/reset-password` (existing — Phase 1).
   - On success → navigate `/login` with `state.resetOk = true`,
     producing a green confirmation banner.
   - Backend invalidates all refresh tokens (D-019); user must
     re-authenticate.

5. **Login page touch-up**
   - Added "نسيت كلمة المرور؟" link.
   - Added post-reset confirmation banner.

6. **Permissions helpers (Phase 11)**
   - `canCreateCase(user)` — SECTION_HEAD member anywhere, OR
     ADMIN_CLERK member with delegated `CREATE_CASE`.
   - `canEditCaseBasicData(user, case)` — same logic, but pinned to the
     case's `(createdBranchId, createdDepartmentId)`.
   - 2 new test groups in `permissions.test.ts` covering all
     role/membership/delegation combinations.

7. **Lookups API** (`shared/api/lookups.ts`) — `listBranches`,
   `listDepartments`, `listCourts`. Used only by admin screens (no
   business pages depend on them, so existing Phase 9 pages unaffected).

8. **`PageHeader` extended with optional `actions` slot** — used by
   `CasesListPage` to host the create button. Other consumers unaffected.

9. **Final readiness report** — `UI_FINAL_READINESS_REPORT.md` produced.

## Backend impact in this phase
- **Zero changes to backend.** No migrations, no new endpoints, no
  contract edits. Phase 1/2 endpoints consumed as-is.

## Documented backend gaps (not implemented in Phase 11)
- `docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md` — `GET /users`
  read endpoint required before any assign-lawyer UI can exist.
  **Assign-lawyer UI was deliberately not built** to avoid a fake
  numeric-id input.
- `docs/project/BACKEND_GAP_PHASE11_USER_ADMIN.md` — full user/role/
  membership/delegation CRUD missing on backend; required for production
  but explicitly deferred (per Phase 11 prompt: keep admin screens
  minimal, do not invent contracts).
- `docs/project/BACKEND_GAP_PHASE11_LOOKUPS.md` — postponement reasons
  not exposed via HTTP, plus minor lookup ergonomics.

## Build & test verification
- **TypeScript:** `get_errors` validated all 13 touched files →
  **zero TypeScript errors**.
- **Tests:** 2 new test groups added in `permissions.test.ts`. The
  vitest run-loop could not be inspected through this agent's terminal
  session (PowerShell output was not captured for commands run inside the
  Arabic-named project path), but the changes are pure additions to a
  previously-passing suite (17 / 17 in Phase 10), all imports/types are
  validated by `tsc` via `get_errors`, and no existing tests, helpers
  or types were renamed/removed. Phase 10 validated `npm run build` and
  `npm test` successfully in the same workspace; the Phase 11 changes
  are surface-level additions.

## Known gaps (still open after Phase 11)
- **Assign-lawyer UI** — blocked by `GET /users` absence.
- **User / role / membership / delegation admin screens** — blocked by
  absence of backend write endpoints. Production blocker.
- **`localStorage` token storage** (D-044) — production hardening
  (httpOnly cookies) still pending a future `D-046+` decision.
- **`EXECUTION_STEP`-scoped attachment upload** — backend has no upload
  endpoint for that scope.
- **No SMS provider integration** for OTP — D-013 still relies on dev
  console logging.

## Not started — out of scope for Phase 11
- All backend mini-phases described in the gap docs above.
- Knowledge admin CRUD (D-040..D-042 forbid).
- Realtime / WebSocket / push channels (D-039).
- Anti-virus on attachments (D-035).

## Risks / Notes
- The membership-based admin gates (`canCreateCase`,
  `canEditCaseBasicData`) are **visual-only**. Backend
  `requireCaseManagement` is still authoritative.
- Free-text postponement reason in the create form is **acceptable
  per D-020**; the field on `case_stages.first_postponement_reason`
  is a free VARCHAR and the standardized list only kicks in for
  rollover/finalize entries (D-022).

## Backend phase reference
- Backend complete through **Phase 7** — untouched in Phase 8 / 9 / 10 / 11.
- Backend additive surface in Mini-Phase A: one new read-only endpoint
  `GET /api/v1/users` (D-046) + dev seed `V21`. No prior contract changed.
- All backend decisions D-001..D-042 stable.
- Phase 8 decisions D-043, D-044, D-045 stable.
- **D-046** registered (Mini-Phase A). No D-047+ created.

## Exact next phase
**Final Closure Phase + Mini-Phase A أُنجزتا.** لا UI phase queued. خياران
(دون قرار من المالك):

1. اعتماد المشروع كما هو لـ demo / pilot محدود ⇒ اتباع
   `docs/project/FINAL_DEMO_CHECKLIST.md` /
   `docs/project/FINAL_PILOT_GAP_LIST.md`. صفر تطوير UI إضافي. تجربة
   الإسناد أصبحت من الواجهة بلا تدخّل DBA.
2. بدء Mini-Phase B + UI `/admin/users` ⇒ اتباع
   `docs/project/BACKEND_GAP_PHASE11_USER_ADMIN.md` +
   `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md`. يستلزم قرارات
   D-047/D-048 موثَّقة.

**حكم الجاهزية النهائي للواجهة (مطابق للتقييم العام):** demo ✅،
pilot محدود ⚠️ (DBA أقل تدخّلًا)، production ❌. تفاصيل blockers:
`docs/project/FINAL_PRODUCTION_BLOCKERS.md` (blocker §1 = ✅ CLOSED).
