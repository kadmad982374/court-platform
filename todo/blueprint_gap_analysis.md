# Blueprint Compliance — Gap Analysis

**Analysis date:** 2026-04-23
**Blueprint (customer requirements):** `docs/project/FINAL_ARABIC_BLUEPRINT_STATE_LITIGATION_SYSTEM.md` (747 lines, 22 sections)
**Method:** Parallel specialist review — 5 agents covered §3-4, §6-9, §10-14, §15-16, §17-20 — then synthesized
**Scope:** Read-only code inspection. NO code was modified.

**Legend:** ✅ fully aligned · ⚠️ partial / minor caveats · ❌ missing · 🔄 implemented but diverges from blueprint

---

## Executive summary

The backend is **substantially aligned** with the customer blueprint at the **data model, permission, and lifecycle level**. All 14 branches, 4 section types, 6 roles, 9 registration fields, 4 decision types, 8 postponement reasons, append-only hearing archival, appeal-to-read-only transition, execution-as-dated-actions, and derived monthly register are implemented as specified and enforced server-side.

The **frontend and workflow coverage is where the customer will push back hardest**. The main navigation is missing 2 of the 8 blueprint-required menu items (day's sessions + Admin-internal circulars as a separate entry), there is no user-facing signup page, no reports module, and the decisions-register UX is a flat filter form rather than the yearly-register-with-months metaphor the blueprint describes. Some declared capabilities (post-finalization correction, cross-phase attachment continuity, comprehensive audit trail) are half-wired — the permissions/enums exist but the endpoints/queries don't.

**Overall compliance snapshot:**

| Area | Status |
|---|---|
| Organizational structure (§3) | ✅ aligned |
| Permission rules (§4) | ✅ aligned |
| Case lifecycle (§6-7) | ✅ aligned (1 endpoint missing) |
| Monthly register (§8) | ✅ aligned |
| Appeals (§9) | ✅ aligned |
| Execution (§10) | ⚠️ mostly aligned (1 endpoint + 1 upload path missing) |
| Attachments (§11) | ⚠️ **cross-phase continuity broken** |
| Notifications/Reminders (§12) | ✅ aligned |
| Legal library + directory (§13-14) | ✅ aligned |
| **Accounts (§15)** | ❌ **signup page missing entirely** |
| **UI (§16)** | ❌ **multiple blueprint-required screens missing/merged** |
| Archiving (§17) | ⚠️ per-entity only; no unified audit |
| Reports (§18) | ❌ **no reports module** |
| Integration seams (§19) | ⚠️ event-bus exists; no channel abstraction |
| Mandatory technical rules (§20) | ✅ mostly met (one gap on basic-data edit history) |

**Counts:**
- ✅ Fully aligned: **37 items**
- ⚠️ Partial: **17 items**
- ❌ Missing: **7 items**
- 🔄 Diverges: **5 items**

---

## 🔴 Critical gaps — customer will flag these first

These directly contradict explicit blueprint requirements and will surface in any customer acceptance review.

### C-1 · No user-facing signup page (§15.0, §15.1)

**Blueprint says:** The system supports login, **account creation**, forgot password, verify, reset. Signup must collect at minimum: username, branch, court, mobile number.

**Reality:** `frontend/src/features/auth/` has `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` — but **no registration page exists**. `grep signup|register-account|account-request` returns zero matches in both frontend and backend. `CreateUserModal.tsx` in `features/admin-users/` is an admin-only provisioning tool, not the §15 self-service flow.

**Impact:** Users cannot create accounts without a central admin provisioning them. Blueprint clearly envisions self-registration (with admin approval, implied by the field set).

---

### C-2 · No "جلسات المحكمة" (day's sessions) screen — blueprint §16.3 item 1, §16.4

**Blueprint says:** Main menu must have direct access to a page showing a specific day's hearings (example given: "جلسة يوم الاثنين 5/3/2026") with the list of case files for that day. This is the **first** item in the blueprint's main-menu list.

**Reality:** Not implemented. No route, no page, no nav entry. `features/navigation/navItems.ts:18` has an explicit comment deferring hearings. Every other main-menu item has at least some implementation.

**Impact:** This is the lawyer's main daily work screen per the blueprint. Its absence means lawyers must currently navigate via the flat case list.

---

### C-3 · MoJ circulars and Admin circulars merged into one entry — §16.3 items 7 & 8

**Blueprint says:** Main menu must have TWO separate entries:
- قرارات وتعاميم وزارة العدل (Ministry of Justice circulars)
- قرارات وتعاميم الإدارة (Administration's internal circulars)

**Reality:** `navItems.ts:35` exposes one entry `التعاميم` → `/circulars`. The backend data model DOES distinguish (`domain.ts:187` `CircularSourceType = MINISTRY_OF_JUSTICE | STATE_LITIGATION_ADMINISTRATION`) and the list page shows the source label per row, but the UI has:
- No separate menu entry for each source type
- No source-type filter / tab / segmented control

**Impact:** Simple UI fix (split the nav item + add source-filter) but currently non-compliant with the blueprint's explicit 8-item menu.

---

### C-4 · Cross-phase attachment continuity broken — §11.4

**Blueprint says:** When a case moves from primary/reconciliation → appeals, previous attachments **MUST remain visible** (read-only) in the new appeals phase.

**Reality:** `attachments/infrastructure/AttachmentRepository.java:10` keys strictly on a single `scope_id`. `AttachmentService.listForStage` (line 72-80) queries only the requested `stageId`. The appeal promotion DOES correctly store `parentStageId` on the new stage (`CaseStage.java:60-61`, `CaseStagePortAdapter.java:137`), but **no code walks the parent chain** when listing attachments. `grep "parentStageId|parent_stage|ancestor"` under `attachments/` returns zero matches.

**Impact:** The appeals lawyer cannot see the primary-phase attachments — a hard blueprint violation. The data is preserved, just not surfaced.

---

### C-5 · No reports module — §18

**Blueprint says:** Must support reports suitable for central admin, branch head, section head, and read-only supervisor — each scoped to their permission boundary.

**Reality:** No `reports/` backend module exists. No controller/service named `*Report*`. The only aggregate-style endpoint is `/api/v1/resolved-register`. The `ScopeFilter` pattern used by `ResolvedRegisterQueryDao` is exactly the primitive needed to build this, but nothing builds on top of it.

**Impact:** Supervisors (central admin, branch heads) have no executive view. Blueprint §18 is an explicit requirement.

---

### C-6 · No post-finalization correction flow — §7.4

**Blueprint says:** Section head CAN correct specific errors on a finalized case; corrections must be archived/audited.

**Reality:** The permission `DelegatedPermissionCode.CORRECT_FINALIZED_CASE` is declared (`DelegatedPermissionCode.java:20`) and seeded. **Zero endpoint, service method, or consumer exists** — `grep CORRECT_FINALIZED_CASE` returns only the enum declaration, seed SQL, tests, and a frontend type. `CaseDecision` entity fields are all `updatable=false` (`CaseDecision.java:22-45`), so corrections are physically impossible today.

**Impact:** Section heads cannot correct finalized cases even though the permission system says they can. Customer acceptance criterion §7.4 unmet.

---

### C-7 · Decisions register UI is a flat filter, not yearly-with-months — §16.6

**Blueprint says:** The register must be displayed as **annual, with the months**, and clicking a month opens that month's finalized cases.

**Reality:** `ResolvedRegisterPage.tsx` is a flat table with numeric year/month inputs (lines 59-66) — no yearly card layout, no month drill-down, no calendar metaphor. The backend DAO supports this filtering correctly (`ResolvedRegisterQueryDao.java:62-69`), so the fix is UI-only.

**Impact:** UX doesn't match the blueprint's intended visual model.

---

## 🟠 High-priority gaps

### H-1 · Signup flow compressed — no separate OTP verification screen (§15.0, §15.3)

Blueprint §15.0 lists "verify via code" as a distinct flow. Implementation merges code entry + new-pwd + confirm into a single `ResetPasswordPage` form. Functionally equivalent but not the 5-step flow described.

### H-2 · Case detail fragmented across two pages — §16.5

Blueprint §16.5 describes ONE consolidated case detail screen showing parties, basis, postponement reason, decision, date, type, amount, notes, next hearing, and a clear carry-forward button. Implementation splits this across `CaseDetailPage.tsx` (parties, basis) and `StageDetailPage.tsx` (postponement, decision, next hearing, rollover button). Users must drill into the stage page to see most of what §16.5 puts on the case screen.

### H-3 · Basic-data edits overwrite in place — §20.1.4 partial violation

`LitigationCaseService.updateBasicData` (line 227-249) mutates the case/stage columns directly with no history row. §20.1.4 says "preserve previous history, never overwrite on update." Hearings (append-only) and stage transitions (new rows) comply; basic-data edits don't.

### H-4 · No unified audit log — §17 partial

§17 requires archiving of: first registration, assignment, hearing updates, postponements, finalization, appeals transition, execution transition, corrections, attachments. Only hearings and execution-steps are true append-only archives. Assignment overwrites `currentOwnerUserId` in place. No `audit_log` / Envers / history table exists. Events are published via `ApplicationEventPublisher` but not persisted.

### H-5 · Special reviewers lack granular scope — §3.9

Blueprint says judicial inspectors, Minister of Justice, etc. can be granted read access **to a specific branch or all branches**. The `SPECIAL_INSPECTOR` role is seeded (V4:38) but `canReadCase` (line 162) treats it identically to central supervisor — always full-system read, with no per-branch narrowing. No scope column on roles/users exists for this.

### H-6 · "قيد دعوى جديدة" and "قيد ملف تنفيذي" not top-level nav items — §16.3 items 2 & 3

Blueprint lists them as direct main-menu entries. Implementation exposes only `/cases` and `/execution-files` list pages; users must enter the list then click "New". Trivial UX fix but non-compliant with the 8-item menu.

### H-7 · No separate signup endpoint on backend — §15

Corresponding backend endpoint for self-registration (POST `/auth/signup` or similar) does not exist. Matches C-1 on backend side.

---

## 🟡 Medium gaps

### M-1 · §4.7 basic-data fields — implementation is a superset of blueprint's 7

Blueprint enumerates 7 fields: الجهة، الخصم، المحكمة، الغرفة، الأساس، تاريخ أول جلسة، سبب التأجيل الأول.
Implementation's `UpdateBasicDataRequest` exposes 11 fields (splits "الأساس" into `originalBasisNumber + basisYear + stageBasisNumber + stageYear`, adds `publicEntityPosition`). Semantically a valid expansion of "basic data", not a blueprint violation, but not the minimal set.

### M-2 · Chamber nullable (§6.2 field 5)

`LitigationCase.chamber_name` is nullable. Blueprint lists الغرفة as one of the 9 required registration fields, implying required.

### M-3 · Decision amount + currency optional (§7.1)

Blueprint lists "المبلغ المحكوم به" and "العملة" as required finalize fields. Implementation marks both optional (both must be provided together but either can be absent). May be intentional for "غير فاصل" (non-decisive) decisions; worth clarifying with customer.

### M-4 · No "close execution file" endpoint — §10.5

`ExecutionFileStatus` enum has CLOSED/ARCHIVED states but no endpoint transitions to them. Doc at `ExecutionFileStatus.java:6-8` says "Phase 5 لا يكشف endpoint لتعديل الحالة". Lifecycle cannot be completed.

### M-5 · Step-attachment upload endpoint missing — §10.3

`AttachmentScopeType.EXECUTION_STEP` is declared and the read path exists (`AttachmentService.getFileForStep`), but `AttachmentController` only exposes POSTs for `stage` and `execution-file` scopes — not `execution-step`. Read-only support for a scope nothing can write to.

### M-6 · Reminder uses single `Instant` not separate day + time (§12.1)

Blueprint says "في يوم محدد وفي ساعة محددة" (specific day and specific hour). Implementation uses one combined `Instant reminderAt`. Functionally equivalent; diverges only on API shape.

### M-7 · Integration seam is event-bus, not channel-port — §19

`ApplicationEventPublisher` + `@EventListener` is a viable seam for adding an email/SMS channel later, but no formal `NotificationChannel` interface / port exists. `NotificationService.createInternal` is concrete-only.

### M-8 · Library + entity directory UX minimal — §16.7

`LegalLibraryPage.tsx` and `PublicEntitiesPage.tsx` acknowledge this in their own subtitle: "عرض أولي بسيط — التفاصيل والفلاتر تأتي في مراحل لاحقة" ("preliminary simple view — details and filters come in later phases"). Blueprint expects full categorize / browse / enter-category / view-content / search experience.

### M-9 · No server-side monthly grouping headers for register — §8.1

DAO supports year/month filters but sorts flat `ORDER BY cd.decision_date DESC`. Frontend must group. OK as a contract but blueprint examples imply server-side month headers.

---

## 🟢 Low-priority / notes

- Register API has no `POST`/`PUT`/`DELETE` (correctly) — aligned with §8.4/§8.5.
- All Arabic labels in UI are correct and match blueprint terminology.
- RTL handling is clean throughout (only one `border-l` leak noted in earlier audit).
- Testcontainers-based IT tests exercise the role-scoped scenarios correctly.

---

## ✅ What the system gets right (don't regress)

1. **14 branches** seeded exactly as blueprint — name-for-name match.
2. **4 section types** (`CONCILIATION / FIRST_INSTANCE / APPEAL / EXECUTION`) × 14 = 56 departments.
3. **6 core roles** plus `SPECIAL_INSPECTOR` seventh — matches §3.
4. **9 required registration fields** present, `original_registration_date` correctly `updatable=false`.
5. **8 postponement reasons** seeded, exact text match to blueprint's §6.3 list, extensible via `is_active`.
6. **Append-only hearing progression** — `HearingProgressionEntry` all columns `updatable=false`, no UPDATE/DELETE paths.
7. **4 decision types** (`FOR_ENTITY / AGAINST_ENTITY / SETTLEMENT / NON_FINAL`) enforced at JPA + DB CHECK constraint level.
8. **Monthly register is a read model**, not a separate table — `ResolvedRegisterQueryDao` is pure SELECT JOIN across `case_decisions/case_stages/litigation_cases`.
9. **Register insertion by decision month**, not registration month — correctly uses `cd.decision_date` not `lc.created_at`.
10. **Appeal promotion** sets `previousStage.readOnly=true` + `stageStatus=PROMOTED_TO_APPEAL` + creates new stage with `parentStageId` link — §9.1 and §9.2 both implemented.
11. **Execution ≠ hearings** — separate `execution_steps` table, distinct `ExecutionStepType` enum, service comments explicitly enforce: `// لا يلمس HearingProgressionEntry بتاتًا`.
12. **Server-side authorization** everywhere — every write path calls `AuthorizationService.requireCaseManagement / requireCaseOwnership / requireReadAccessToCase` at the service layer, not just UI.
13. **Lawyer ownership** + **branch/section boundaries** + **central read-without-edit** + **branch read-without-edit** all enforced.
14. **Court-access grants per lawyer by section head** — `UserCourtAccess` table + `AccessControlService.updateCourtAccess` + enforcement at case assignment.
15. **Previous phase read-only after transition** — `isReadOnly` flag checked on every write path (hearings, finalize, updateBasicData, assignLawyer).
16. **Notifications on case registration** — `CaseRegisteredEvent` + `NotificationEventListeners` fanout to SECTION_HEAD/ADMIN_CLERK + initial owner. §12.3 met.
17. **Delegation model** — `ADMIN_CLERK` gets section-head capabilities only with explicit delegated permissions, revocable by section head. §3.6 met.
18. **Legal library + public entity directory** have full categorization (including parent/child tree), keyword search across multiple fields, and role-based read access.

---

## 📋 Remediation backlog (to be merged into `findings.md`)

Add these to the existing backlog at `todo/findings.md` as a new Phase 9 "Blueprint alignment":

### Phase 9 — Blueprint alignment (customer acceptance)

**Risk:** medium · **Est:** 4–6 sessions

#### 🔴 Critical (unblock customer acceptance)

- [ ] **P9-01** Add user-facing signup page + backend `/auth/signup` endpoint. Fields per §15.1: username, branch, court, mobile. OTP-verify gate on submission. Admin-approval step before first login.
- [ ] **P9-02** Implement "جلسات المحكمة" screen + route + top-level nav item. Backend endpoint: hearings-by-date filtered by user's read scope. Frontend: daily/weekly/monthly calendar view with case list per day.
- [ ] **P9-03** Split circulars UI: two separate nav entries (MoJ vs Admin), each filtered by `CircularSourceType`.
- [ ] **P9-04** Fix cross-phase attachment continuity: `AttachmentService.listForStage` must walk `parent_stage_id` chain and merge previous-phase attachments (read-only flag).
- [ ] **P9-05** Build reports module: `/api/v1/reports/*` endpoints for central / branch / section / owner scopes, reusing the existing `ScopeFilter` pattern. Frontend: at minimum a "تقارير" main-menu entry with 3–4 canonical reports.
- [ ] **P9-06** Implement post-finalization correction flow: endpoint `PATCH /cases/{id}/decision` gated by `CORRECT_FINALIZED_CASE` delegation. Must write an audit row (requires P9-10).
- [ ] **P9-07** Redesign decisions-register UI to yearly-card-with-months layout — card per year → month tiles → drill into month list.

#### 🟠 High

- [ ] **P9-08** Split OTP verify into its own step between `ForgotPasswordPage` and `ResetPasswordPage`, OR explicitly document the compressed flow as intentional in blueprint alignment notes.
- [ ] **P9-09** Consolidate case-detail screen per §16.5 — surface postponement/decision/next-hearing/rollover-button on `CaseDetailPage` itself (not only on `StageDetailPage`). Consider merging the two pages.
- [ ] **P9-10** Add `audit_log` table + `AuditEventListener` consuming existing `ApplicationEvent`s to persistently record: registration, assignment, basic-data edits, attachments, transitions, corrections.
- [ ] **P9-11** Stop overwriting basic-data fields in place — write prior value to `audit_log` before mutation (or create a `case_basic_data_history` append-only table).
- [ ] **P9-12** Grant granular scope to `SPECIAL_INSPECTOR` role — add `user_scope` table (user_id, scope_type=ALL/BRANCH, branch_id_or_null) and honor it in `canReadCase` / `buildScopeSpec`.
- [ ] **P9-13** Add top-level "قيد دعوى جديدة" and "قيد ملف تنفيذي" nav items (direct to create form, not list).

#### 🟡 Medium

- [ ] **P9-14** Confirm with customer: is `chamber_name` required? If yes, Flyway migration to `NOT NULL` (with data backfill).
- [ ] **P9-15** Confirm with customer: are `adjudgedAmount`/`currencyCode` required for ALL decision types or only for `FOR_ENTITY`/`AGAINST_ENTITY`? Codify.
- [ ] **P9-16** Add `PATCH /execution-files/{id}/close` endpoint + `CLOSE_EXECUTION_FILE` delegation; cascade to `LitigationCase.lifecycleStatus=CLOSED`.
- [ ] **P9-17** Add `POST /execution-steps/{stepId}/attachments` endpoint to match the already-existing read path.
- [ ] **P9-18** Consider exposing reminder as separate `reminderDate + reminderTime` fields in the DTO (backend can keep storing `Instant`).
- [ ] **P9-19** Formalize integration seam: introduce `NotificationChannel` interface with `InAppChannel` current impl + empty `EmailChannel` / `SmsChannel` stubs to document the extension points per §19.
- [ ] **P9-20** Flesh out legal library + entity directory UX to full blueprint §16.7 (clickable categories, search input, category tree).

#### 🟢 Low

- [ ] **P9-21** Reconcile `UpdateBasicDataRequest` field set with blueprint's 7 — either slim to blueprint's exact list or document in a D-xxx decision why the expanded set is correct.
- [ ] **P9-22** Add server-side monthly grouping to resolved-register response so frontend doesn't need to re-group.

---

## 🧠 Memory-keeper WRITE — simulated (no disk write yet)

```
━━━ MEMORY UPDATED (simulated) ━━━

Sections that WOULD change in .claude/project_knowledge_base.md:
  §9 Production blockers — add "Blueprint compliance" sub-list:
    - No user signup page
    - No day's sessions view
    - Circulars not split by source
    - Cross-phase attachment continuity broken
    - No reports module
    - No correction flow for finalized cases
    - Decisions register UX not yearly-with-months
    - No unified audit log
  §6 Key Features — mark which modules are blueprint-complete vs partial:
    - Complete: identity, access, litigationregistration, litigationprogression,
               decisionfinalization (minus correction), resolvedregister,
               notifications, legallibrary, publicentitydirectory, circulars
    - Partial: attachments (no cross-phase), execution (no close),
              stagetransition, reminders (single Instant)
    - Missing: reports, signup, audit-log

New decisions to reserve (pending user confirmation):
  - D-052..D-062: one per blueprint-gap resolution (Phase 9 items above)

Counts corrected:
  - Blueprint compliance: 37 fully aligned / 17 partial / 7 missing / 5 diverges = 66 checked items
  - Overall system: core lifecycle ✅ complete; customer-facing UI and admin
    tooling have substantive gaps
```

---

## Final word

The backend is **closer to blueprint-complete than the frontend is**. The customer-facing gaps (signup, day's sessions, split circulars, register UX, reports) are UI work on top of mostly-correct backend contracts. The two backend gaps that matter most are cross-phase attachment visibility (C-4) and the missing finalized-case correction flow (C-6) — the second is a permission declared but never wired.

If the customer demo focuses on lawyer workflow (log in → see my cases → update a hearing → finalize → see in register → appeal → execute), the current system hits every lifecycle checkpoint. If the demo asks "where do I sign up?", "show me today's hearings", "show me monthly reports", or "fix this typo on a finalized case", it will fail.
