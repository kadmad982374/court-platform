# Customer Feedback Round 1 — Analysis & Plan

**Status:** ✅ Customer answers received (`feedback/customer-answers`); PR-8 shipped; PR-8b..PR-14 pending.
**Source feedback:** `feedback/ملاحظات على النسخة التجريبية لنظام ادارة قضايا الد_260505_003541.pdf`
**Customer answers:** `feedback/customer-answers` (received 2026-05-05)
**Analysis date:** 2026-05-05
**Stack at time of analysis:** `dev` branch with PR-1..PR-7 merged; PR-8 shipped on a separate branch.

This document captures the full deep-analysis we did before any code was written, so we can resume
without re-deriving anything once the customer answers.

---

## 1. Customer asks (translated, grouped by role)

### ADMIN (CENTRAL_SUPERVISOR)
| ID | Ask | Type |
|---|---|---|
| **A-1** | Broadcast messaging — admin can send a message to all users, a specific branch, a specific department, a single user, or multiple branches | NEW FEATURE |
| **A-2** | Replace "actions on case level" panel with an interactive dashboard chart (pie: Active 48% / Resolved 18% / For-state 8% / Against-state 7% / Settlement 13% / Non-final 6%) and money totals | NEW FEATURE + UX |
| **A-3** | Cases listing must NOT show all cases at once — needs filters (like resolved register) by name + branch + department + case type | UX / SCALE |
| **A-4** | When admin opens a case, hide the "create reminder" UI — that's STATE_LAWYER only | UX |
| **A-5** | Admin can't open any case from the resolved register and view its stages + attachments | BUG (perceived) |

### BRANCH_HEAD (Head_dam)
| ID | Ask | Type |
|---|---|---|
| **B-1** | Cases page must filter by department (Conciliation / FI / Appeal / Execution), then within department let user pick a court → see cases in that court | UX / SCALE |
| **B-2** | Don't show "actions on case level" panel on case detail | UX |
| **B-3** | Resolved register filter for branch_head: Year + Month + Department + Decision Type — NO branch picker | UX |
| **B-4** | Couldn't open any case in resolved register as branch head — must be able to read-only open | BUG (perceived) |
| **Q-1** | Question (not a complaint): how do reminders work? Are they personal? | NEEDS ANSWER |

### SECTION_HEAD (Section_dam)
| ID | Ask | Type |
|---|---|---|
| **C-1** | Cases page: filter by court → see cases + lawyer following each | UX |
| **C-2** | Case detail: keep "promote to execution" button | OK as-is |
| **C-3** | "Promote to execution" form must auto-populate from source case | BUG (UX) |
| **C-4** | Promotion (execution OR appeal) must notify destination department's section head | MISSING |
| **C-5** | Resolved register filter for section_head: Year + Month + Court + Decision Type — NO branch/dept | UX |
| **C-6** | Section_head can OPEN any case in their dept's resolved register and correct basis number / decision number / decision date / decision type — but ONLY if not yet promoted | NEW FEATURE (= blueprint gap C-6) |
| **C-7** | Section_head viewing execution dept: see only PROMOTED files; cannot see step-level activity | PERMISSION MODEL |

### ADMIN_CLERK (clerk2_fi_dam)
| ID | Ask | Type |
|---|---|---|
| **D-1** | Cases page: same filter system as section_head | UX |
| **D-2** | Execution dept: see promoted files only, no edit, no step actions (steps are lawyer-only) | PERMISSION MODEL |

### EXECUTION DEPT
| ID | Ask | Type |
|---|---|---|
| **E-1** | Execution works by case, not by court — same court, multiple lawyers handling separate files | DOMAIN MODEL |
| **E-2** | Execution-files page: filter by region/area (Latakia / Jableh / Qardaha / Hffeh) + file type + year + enforcing entity | NEW FEATURE |
| **E-3** | Replace "Resolved Register" sidebar item (in execution context) with "Executed Files" — files whose execution is fully done | RENAME + NEW VIEW |
| **E-4** | "Files under registration" view with same filters | NEW VIEW |

---

## 2. Code reality (validated against the codebase on `dev`)

| ID | Code area | Current state |
|---|---|---|
| A-1 | nowhere | Zero hits for "broadcast/announce" anywhere. Fully greenfield. |
| A-2 | `pages/DashboardPage.tsx:6-58` | Placeholder showing user info + links. No aggregation endpoint exists. |
| A-3/B-1/C-1/D-1 | `CasesListPage.tsx:20-140` + `LitigationCaseService.listCases` | Frontend has zero filter inputs. Backend `listCases` accepts ONLY page/size — branch/dept/court not parameterized; only implicit scope filtering via `buildScopeSpec`. |
| A-4 | `RemindersSection.tsx:85-87` | "إنشاء تذكير" shown to everyone. No role gate. |
| A-5/B-4 | `ResolvedRegisterPage.tsx:125-141` | Rows are static. No `<Link>` or `onClick`. CaseId IS in response. **The customer's "couldn't open" is a UX bug, not a permission bug** — `requireReadAccessMultiScope` correctly admits CENTRAL_SUPERVISOR (line 167) and BRANCH_HEAD-of-own-branch (line 168). |
| B-2 | `CaseDetailPage.tsx:149-193` | Actions card with 3 buttons (edit / promote-to-appeal / promote-to-execution) shown unconditionally. |
| B-3/C-5 | `ResolvedRegisterPage.tsx` | Has year/month/branchId/departmentId/decisionType. Customer wants role-aware shape + court filter. |
| C-3 | `CaseDetailPage.tsx:296-356` (PromoteExecutionModal) | Modal uses `register()` with NO `defaultValue`/`useEffect` pre-fill. Opens empty. |
| C-4 | `notifications/NotificationEventListeners` | Events `CasePromotedToAppealEvent` + `CasePromotedToExecutionEvent` **exist but have NO `@EventListener` consumer**. Plumbing half-built. |
| C-6 | `DelegatedPermissionCode.java:20` | `CORRECT_FINALIZED_CASE` enum constant defined and seeded. **ZERO references anywhere else.** Confirmed blueprint gap C-6. |
| C-7/D-2 | `execution/ExecutionFilesPage.tsx` + `ExecutionService` | Section_head + admin_clerk see all execution files in scope, including step-level detail. |
| E-1..E-4 | execution module | "Region" concept does NOT exist. Schema has only `branches + departments + courts`. The Latakia example (Latakia, Jableh, Qardaha, Hffeh) maps to courts within Latakia branch. **Need customer confirmation (Q-A).** |
| Q-1 | `ReminderService.java:49-73` | Confirmed: reminders are personal to creator. Not visible to other users. |

---

## 3. Open questions sent to customer (Q-A..Q-G) — ANSWERED

Full Arabic text in `feedback/questions_for_customer_ar.md`. Customer answers received in `feedback/customer-answers` (2026-05-05).

| # | Question | Our default | Customer answer | Status |
|---|---|---|---|---|
| **Q-A** | Region concept | (B) Relabel court | **(B)** | ✅ Match |
| **Q-B** | Dashboard placement | (C) Both | **(C)** | ✅ Match |
| **Q-C** | Broadcast retention | (A) Notifications fan-out | **(A)** | ✅ Match |
| **Q-D** | Correction window | (A) Any promotion freezes | **(C) Correction rights TRANSFER on promotion** to destination dept; otherwise current section head can edit basic + decision data without touching session history | ⚠️ Refinement |
| **Q-E** | Clerk in execution | (B) Hide UI, delegation overrides | **(A) Total ban** — admin_clerk never sees step UI regardless of delegation | ⚠️ Stricter |
| **Q-F** | Money fields | (A) Adjudged only in v1 | **(A)** | ✅ Match |
| **Q-G** | Reminder semantics | (A) Personal-only | **(C) Hierarchy oversight + manager-initiated notifications**: BRANCH_HEAD/SECTION_HEAD can READ lawyer reminders within scope, AND can BROADCAST notifications down the hierarchy (like admin can — A-1) | ⚠️ Significant expansion |

### Translation of customer's nuanced answers

**Q-D (ج):** "الترقية الى اي قسم تمنع التصحيح ولكن يصبح التصحيح من صلاحية القسم الذي رقي الملف اليه سواء كان تنفيذ او استئناف او صلح. اما في حال عدم الترقية فيمكن لرئيس القسم المختص تصحيح بيانات الملف الاساسية وبيانات القرار الصادر دون المساس بمسار الجلسات السابقة"

→ The CURRENT-OWNER department's section head has correction rights. After promotion, those rights transfer to the destination department's section head. Hearing log is never touched (already enforced by D-022 append-only).

**Q-G (ج):**
- Lawyers create reminders as personal sticky-notes (existing).
- BRANCH_HEAD and SECTION_HEAD can SEE these reminders for cases in their scope (NEW — oversight read mode).
- BRANCH_HEAD can SEND notifications to all / some / one lawyer in their branch.
- SECTION_HEAD can SEND notifications to all / some / one lawyer in their dept.
- Reminders ≠ notifications. Reminders are personal action notes. Notifications are manager-initiated messages.

---

## 4. Risk-ranked verdict

**P0 — real bugs they hit, must fix**
- A-5 / B-4 — Resolved register rows aren't clickable
- C-3 — Promote-to-execution modal opens empty
- C-4 — Promotion notifications missing (events fire, listeners empty)

**P1 — UX scale issues (break with real data volume)**
- A-3 / B-1 / C-1 / D-1 — Filtered case listing per role
- B-3 / C-5 — Role-aware resolved register filters
- A-4 / B-2 — Hide actions/reminder UI where they don't belong

**P2 — real new features the customer requested**
- A-2 — Admin dashboard with case-statistics chart
- C-6 — SECTION_HEAD correction of decision before promotion
- C-7 / D-2 — Execution permission narrowing
- E-2 / E-3 — Execution dept "by region" view + "Executed Files" rename
- A-1 — Broadcast messaging

**P3 — Just answer**
- Q-1 — Reminders are personal; document in user guide

---

## 5. PR plan (revised after customer answers)

| PR | Status | Scope | Customer-answer adjustments |
|---|---|---|---|
| **PR-8** ✅ shipped | merged on its branch | A-4 hide reminder · A-5/B-4 link resolved-register rows · B-2 hide actions panel · C-3 auto-fill promote-to-execution · C-4 wire promotion notifications | A-4 needs follow-up (see PR-8b) |
| **PR-8b** Reminder oversight read mode | ready | Backend `ReminderService.list` returns reminders for cases in actor's oversight scope when actor is BRANCH_HEAD/SECTION_HEAD. Frontend `RemindersSection` shows the section to managers as read-only (no Create button, no Done/Cancel) | NEW from Q-G |
| **PR-9** Filtered case listing | ready | A-3/B-1/C-1/D-1: backend `listCases` gains `branchId`/`departmentId`/`courtId`/`q`; frontend role-aware filter UI | unchanged |
| **PR-10** Role-aware resolved register | ready | B-3/C-5: hide branch/dept inputs by role; add `courtId` filter | unchanged |
| **PR-11** Decision correction | ready | C-6: new `PATCH /api/v1/cases/{id}/decision` gated by `CORRECT_FINALIZED_CASE`. Auth check uses CURRENT stage's (branch, dept) — rights transfer on promotion per Q-D. Hearing history untouched (D-022). | **Q-D refinement applied** |
| **PR-12** Execution scope + region | ready | C-7 narrow exec to file-rows for non-execution roles · D-2 ADMIN_CLERK never sees step UI (no delegation override) · E-2/E-3 rename exec sidebar to "Executed Files" + region filter (region = court) | **Q-E stricter, Q-A confirmed** |
| **PR-13** Dashboard chart | ready | A-2: new `GET /api/v1/reports/case-summary` + dashboard widget with `recharts` (chart on home + summary on cases page per Q-B). Adjudged-amount totals only per Q-F. | **Q-B, Q-F confirmed** |
| **PR-14** Multi-role broadcast | ready | A-1 + Q-G expanded: three sender roles with scope-bounded recipient pickers. ADMIN sends to all/branch/dept/user. BRANCH_HEAD sends to lawyers in own branch. SECTION_HEAD sends to lawyers in own dept. Same fan-out mechanism. | **Q-G expansion applied** |

**Recommended execution order:** PR-8b → PR-9 → PR-10 → PR-11 → PR-12 → PR-13 → PR-14.

**Total: ~12 days, 7 PRs. Same as original plan; work redistributed per customer answers.**

---

## 6. Things I will NOT do (deliberate non-goals)

- Don't add a `regions` table until Q-A is confirmed. Cost of being wrong is migration churn.
- Don't introduce a charting library other than `recharts` in PR-13 (React standard, MIT, ~30KB gz).
- Don't expand reminder semantics in this round (Q-1) — document current behavior.
- Don't refactor the actions panel into a permissions matrix — just hide it for the roles the customer specified.
- Don't add a "must change password" UI even though we have the data layer for it (D-049). Customer didn't mention it.

---

## 7. Resume protocol

When the customer answers:

1. Update this file with their answers under each Q-X heading.
2. Move the "Awaiting customer answers" task to completed.
3. Start with **PR-8** (unblocked regardless of answers — quick wins).
4. Stack PR-9, PR-10 on top.
5. As Q-A..Q-G answers arrive, unblock PR-11..PR-14 in any order.
6. Each PR:
   - Branches off `dev`
   - Commits use `Touches: A-X B-X` etc. for traceability
   - Re-runs `scripts/e2e_smoke_test.py` against the demo stack before merging
   - Frontend rebuild via `docker compose -f docker-compose.demo.yml up -d --build --no-deps frontend`

If the customer rejects a default in Q-A..Q-G, flag the new direction here BEFORE starting the
affected PR.
