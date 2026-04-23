# DEMO_VIDEO_COVERAGE_GAPS — what the single demo video does NOT yet show

Source spec analysed: `frontend/e2e/tests/demo/00-full-system-demo.spec.ts`
(see `frontend/e2e/DEMO_VIDEO_RUN.md` for context).

The QA-grade `roles/` and root `01–10` specs cover much more, but the user
asked specifically about the **video** demo (the one that produces a single
`video.webm`). This file inventories what is missing from that recording so
it can be extended to a true 100% functional walk-through.

Legend:
- ✅ shown in the video today
- ⚠️ touched only superficially (page opened, no real interaction)
- ❌ not in the video at all
- 📄 covered elsewhere in the QA suite (so the data layer works — only the
  *visual coverage* in the recording is missing)

---

## 1. What the video shows today (baseline)

| # | Role | What is recorded |
|---|------|------------------|
| 1 | SECTION_HEAD | login → cases list → **create case (full form)** → case detail → **assign lawyer** → logout |
| 2 | STATE_LAWYER (owner) | login → open Case 2 → open stage → **open rollover dialog (cancel)** → notifications page → logout |
| 3 | ADMIN_CLERK | login → resolved-register page → open Case 3 (finalized) → logout |
| 4 | ADMIN_CLERK | execution files list → execution file 1 detail → logout |
| 5 | READ_ONLY_SUPERVISOR | cases / resolved-register / legal-library / public-entities / circulars (all read-only) → logout |
| 6 | CENTRAL_SUPERVISOR | dashboard → profile → cases list → **/admin/users** (filter by role + active, **create user**, tour the 5 admin sections, **add+remove role**) |

Roles never logged into in the video: **BRANCH_HEAD**, **ADMIN_CLERK_WITHOUT_ASSIGN**, **STATE_LAWYER non-owner**, **SPECIAL_INSPECTOR** (last one has no seed — ENV gap).

---

## 2. Functional gaps by domain

### 2.1 Identity & Authentication (FUNCTIONAL_SCOPE §1.1)
- ❌ **Login failure** screen (wrong password → red Arabic error). 📄 Covered by `01-auth.spec.ts`.
- ❌ **Forgot-password** entry from login (even just opening the page).
- ❌ **OTP reset flow** (ENV-LIMIT-002 — OTP only printed to backend log; can still record the request screen).
- ❌ **Self-service change-password** on `/profile`.
- ❌ Real **logout via UI button** (the spec hacks `localStorage.clear()` instead of clicking the logout control).
- ❌ **Protected-route redirect** (visiting `/cases` while logged out bouncing to `/login`). 📄 in `01-auth.spec.ts`.

### 2.2 Organization & lookups (§1.2)
- ❌ Branches → departments → courts cascading lookup (only happens *implicitly* inside the create-case form). A read-only walk-through of the org tree would visualise §1.2.

### 2.3 Access-control admin (§1.3) — `/admin/users/{id}`
The video opens the 5 sections but only **interacts with Roles**.
- ⚠️ `admin-memberships-section` — only scrolled into view, no add/patch.
- ⚠️ `admin-delegations-section` — only scrolled into view, no add/patch (`MANAGE_COURT_ACCESS`, `CREATE_CASE`, `ASSIGN_LAWYER`).
- ⚠️ `admin-court-access-section` — **never exercised** (this is the very section whose 500-bug we just fixed today; the video would have caught it).
- ❌ **Reset user password** (admin button).
- ❌ **Lock / unlock** user.
- ❌ **Deactivate / re-activate** user (`active=false` filter is shown — no actual flip).
- ❌ Negative-access screen: a non-admin trying to open `/admin/users` and getting blocked. 📄 in `admin-users/05-negative-access.spec.ts`.

### 2.4 Litigation registration (§1.4)
- ✅ Create case (SECTION_HEAD).
- ❌ **Edit basic case data** (PATCH /cases/{id} within scope) — the form/route exists but is never opened.
- ❌ **Direct exceptional finalize** (الفصل المباشر الاستثنائي §6.5).
- ❌ **Search / filter** the cases list (by branch, dept, court, status, date range, opponent, public-entity name).
- ❌ **Pagination & sorting** of `/cases`.
- ❌ Validation error UX (submit with missing field → red banner — proves the front-end form is wired).

### 2.5 Hearing progression (§1.5)
- ⚠️ Rollover dialog **opened then cancelled** (intentional, to keep V22 seed stable).
- ❌ **Actual rollover SUBMIT** on a *fresh* case created earlier in the same recording (would not pollute seed because the case is new).
- ❌ **Hearings history view** — full append-only timeline showing previous rolled-over hearings + reasons.
- ❌ **"شاشة جلسات اليوم" / Today's hearings** screen (explicit §1.5 deliverable).

### 2.6 Decision finalization (§1.6)
- ❌ **Finalize a stage end-to-end** (decision number, decision date, decision type, amount, currency, summary) on the freshly-created case.
- ❌ Verifying the stage flips to `FINALIZED` after submit.
- ❌ Direct exceptional finalize (§1.4).

### 2.7 Resolved register (§1.7)
- ⚠️ Page opened — no filter, no drill-down.
- ❌ **Filter by month/year** (matches §8.3 of the functional doc). 📄 in `06-resolved-register.spec.ts`.
- ❌ **Open a resolved case from the register** and see decision data.

### 2.8 Stage transition — appeal & execution (§1.8)
- ❌ **Promote-to-APPEAL**: clicking the action, watching the parent stage become read-only, the new APPEAL stage appearing.
- ❌ **Promote-to-EXECUTION**: creating an `ExecutionFile` from a finalized stage. (Currently shown only on the *pre-seeded* Execution File 1 — the actual promotion act is never recorded; it's listed as a known limitation in `DEMO_VIDEO_RUN.md`.)
- ❌ Verifying the **parent stage becomes immutable** after promotion (clicking edit/rollover/finalize buttons should be hidden).

### 2.9 Execution files & actions (§1.9)
- ✅ List + open detail.
- ❌ **Add an `ExecutionAction`** (date + description + attachment).
- ❌ Action timeline scroll / chronological order.

### 2.10 Attachments (§1.10)
- ❌ **Upload an attachment to a stage** (image or PDF).
- ❌ **Upload to an execution file / execution action**.
- ❌ Attachments **list** view.
- ❌ **Authenticated download** (KNOWN-GAP-004 / D-035 — at least record the *attempt*).
- ❌ **Validation rejection** (file too big / unsupported type) — proves the size/MIME limits are enforced.

### 2.11 Reminders (§1.11)
- ❌ **Create a reminder** on the freshly-created case (date/time/text).
- ❌ **Change reminder status** (DONE / SNOOZED).
- ❌ Reminders list.
- 📄 The lawyer *seeing* the reminders section is in `09-notifications-reminders-attachments.spec.ts`, but no creation flow is visible in the video.

### 2.12 Notifications (§1.12)
- ⚠️ `/notifications` opened only.
- ❌ **End-to-end notification trigger**: SECTION_HEAD assigns a lawyer → log in as that lawyer → **see unread badge** → open notification → mark read.
- ❌ Notification scope / filtering UI.

### 2.13 Legal library (§1.13)
- ⚠️ Page opened only.
- ❌ Open a **category**, then an **item**.
- ❌ **Keyword search**.
- ❌ Studies-section editor's content management UI (if exposed in pilot).

### 2.14 Public-entity directory (§1.14)
- ⚠️ Page opened only.
- ❌ Drill into a category (ministries → entities).
- ❌ Search.

### 2.15 Circulars (§1.15)
- ⚠️ Page opened only.
- ❌ Filter by **source** (Ministry of Justice vs Administration).
- ❌ Open a circular detail page.

### 2.16 Reports (§1.16)
- ❌ **Reports module is entirely missing** from the video. Dashboard ≠ reports.
- ❌ Central / branch / department / lawyer-scoped report views.
- ❌ Date-range filters, scope-by-role enforcement.
- ❌ Export, if any.

### 2.17 Audit (§1.17)
- ❌ Audit log viewer (admin-side reads of `AuditEvent`) — no recording exists.

---

## 3. Cross-cutting gaps (UX & evidence-of-correctness)

These are not domain modules but they are what makes a "100%" demo video persuasive:

- ❌ **Single end-to-end case lifecycle** in one recording — create → roll-over hearings → finalize → resolved-register → promote-to-appeal → promote-to-execution → add execution actions → upload attachments → set reminders → trigger notifications. Today every module is touched on a *different* pre-seeded case (Case 1, 2, 3, ExecutionFile 1), so the video does not actually demonstrate that the modules are wired together.
- ❌ **BRANCH_HEAD** role login (skipped entirely in the video; covered only by `roles/01-branch-head.spec.ts`).
- ❌ **ADMIN_CLERK_WITHOUT_ASSIGN** comparison shot (proves the delegation gating — covered only by `roles/04-admin-clerk-without-assign.spec.ts`).
- ❌ **STATE_LAWYER non-owner** attempting a foreign case (gets 403 / read-only) — covered only by `roles/06-state-lawyer-non-owner.spec.ts`.
- ❌ **Negative authorization screens** (clerk trying to manage court access of a user outside scope, lawyer trying to open `/admin/users`, viewer trying to write).
- ❌ **Form validation** errors (Arabic copy on missing fields, D-047 banned password literal, D-048 court-outside-scope).
- ❌ **Loading skeletons** and **toast notifications** (proves the UX polish).
- ❌ **Conflict (409) and Forbidden (403) responses** rendered as friendly Arabic messages (e.g., the `COURT_ACCESS_DUPLICATE` we surfaced today).
- ❌ **Logout via the actual sidebar logout control** (today the video clears localStorage in JS).

---

## 4. Documented exclusions (won't be added to the video by design)

These appear in `DEMO_VIDEO_RUN.md` and `roles/99-known-gaps.spec.ts`. They
are **not** real coverage gaps — they exist for environment / seed-stability
reasons. Listed here only so they are not double-counted.

| Item | Reason |
|---|---|
| Reset-password OTP loop | OTP printed only to backend log (ENV-LIMIT-002) |
| Attachment authenticated download | Local-FS storage gap (KNOWN-GAP-004 / D-035) |
| Promote-to-execution live POST | Case 4 already promoted by V22 seed |
| Rollover / finalize submit on the *seeded* cases | Would mutate shared seed and break re-runs |
| `localStorage → httpOnly` cookie migration | Post-pilot hardening (KNOWN-GAP-003 / D-044) |
| SPECIAL_INSPECTOR journey | No seeded account in V20–V22 |

> **Note**: the rollover/finalize-on-seed exclusion *would* go away if the
> video first creates its own fresh case (see §3 first bullet). That is the
> single highest-value change to upgrade the recording from "module tour"
> to "true end-to-end".

---

## 5. Recommended ordered plan to reach ~100% functional coverage in one video

A practical re-shoot script (still one `video.webm`):

1. **Auth foundation** — wrong-password failure → forgot-password page → real login as `section_fi_dam`.
2. **SECTION_HEAD — create a *fresh demo case*** (hold its `caseId` for the rest of the run) → assign lawyer → set 1 reminder → upload 1 attachment.
3. **Re-login as that lawyer** → open notification (assignment) → open the new case → roll over a hearing (real submit) → upload attachment → finalize the stage with a decision.
4. **Re-login as SECTION_HEAD** → see the case in resolved-register (filtered to the right month) → **promote-to-APPEAL** → confirm parent stage is read-only.
5. **Promote-to-EXECUTION** on the appeal stage → open the new ExecutionFile → add 1 ExecutionAction with attachment.
6. **ADMIN_CLERK_WITH_DELEGATIONS** scene → resolved-register filter, opens an old case (read), demonstrates the delegated `CREATE_CASE` button is now enabled.
7. **ADMIN_CLERK_WITHOUT_DELEGATIONS** scene → same screens, assign-lawyer button is hidden, court-access section refuses.
8. **STATE_LAWYER non-owner** → tries to open the case from step 2 → sees forbidden / hidden write surface.
9. **BRANCH_HEAD** → branch-scoped read of cases / execution / resolved-register.
10. **READ_ONLY_SUPERVISOR** → existing knowledge tour + drill into one legal-library item, one circular, one public entity (with keyword search).
11. **CENTRAL_SUPERVISOR / `/admin/users`** — current admin tour **plus**:
    - add a department membership,
    - grant a delegated permission,
    - **grant + revoke a court access** (covers the bug we just fixed),
    - reset a user password,
    - lock then unlock the user.
12. **CENTRAL_SUPERVISOR — Reports module** → at least one central report rendered.
13. **CENTRAL_SUPERVISOR — Audit log viewer** (when shipped).
14. End with a **logout via the sidebar control** (not via JS).

Steps 2–5 alone close the largest gap (the "system actually wires the modules together" question), and step 11 covers the access-control admin surface that today is barely scrolled past.

