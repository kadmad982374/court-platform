# UI ROLE COMPATIBILITY AUDIT — Phase 10

> Audit of every page / section / action implemented in the UI through Phase 10
> against the seven backend roles defined in `RoleType`. Each row tells you:
>
> - **What the role sees** (UI visibility).
> - **What the role can do** (action availability).
> - **What the UI hides on its own** vs. **what relies purely on backend rejection**.
>
> Goal: be honest about gaps. The backend is always the ultimate authority,
> but Phase 10 raises the bar so the UI does not parade actions a user can
> never perform.
>
> Decisions referenced: D-021 / D-022 / D-024 / D-025 / D-027 / D-028 / D-030 /
> D-031 / D-032 / D-035 / D-036 / D-037 / D-038 / D-040 / D-042.

---

## 1) Legend

- 👁 = visible by the UI to that role.
- 🚫 = action button is **hidden** by the UI for that role.
- 🔁 = visible to all roles, scope-filtered by the backend (D-021/D-025/D-028).
- 🛂 = no UI gate; backend rejects with 403/422 if the user is out of scope.
- 👤 = additionally requires being the assigned actor on the row (lawyer for
  the stage, or `assignedUserId` on the execution file).

---

## 2) Sidebar visibility (Phase 10 navigation)

All eight registered nav items use `allowedRoles = ALL_ROLES`. So **any
authenticated user** sees the same labels in the sidebar:

```
عام:        /dashboard, /profile, /notifications
الأعمال:   /cases, /resolved-register, /execution-files
مرجعيات:   /legal-library, /public-entities, /circulars
```

Why no per-role hiding here? Because every list page is **scope-filtered by
the server** (D-021/D-025/D-028) — a `STATE_LAWYER` who has no assignments
will simply see an empty `/cases` list, not a forbidden screen. Hiding the
links would be more confusing than the current behavior.

`READ_ONLY_SUPERVISOR` and `SPECIAL_INSPECTOR` reach all read paths exactly
like other roles; the backend trims their scope per their authorization
context.

`/notifications` is visible to everyone — backend filters to
`recipientUserId == actor`. Roles that never receive a notification (per
D-038: only `SECTION_HEAD` / `ADMIN_CLERK` of the case department + the
assigned lawyer) simply see an empty list.

---

## 3) Cases (`/cases`, `/cases/:id`)

| Action / role | CENTRAL_SUPERVISOR | BRANCH_HEAD | SECTION_HEAD | ADMIN_CLERK (no delegation) | ADMIN_CLERK (+ delegation) | STATE_LAWYER | READ_ONLY_SUPERVISOR | SPECIAL_INSPECTOR |
|---|---|---|---|---|---|---|---|---|
| List `/cases`            | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 |
| Open case detail         | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 |
| **Promote to appeal** (D-027)    | 🚫 | 🚫 | 👁 | 🚫 | 👁 if `PROMOTE_TO_APPEAL` granted | 🚫 | 🚫 | 🚫 |
| **Promote to execution** (D-030) | 🚫 | 🚫 | 👁 | 🚫 | 👁 if `PROMOTE_TO_EXECUTION` granted | 🚫 | 🚫 | 🚫 |
| Create case              | — UI not built (Gap #4) — backend supports it. |
| Edit basic data          | — UI not built (Gap #4) — |
| Assign lawyer            | — UI not built (Gap #3) — |

UI gating implemented in `permissions.ts` (`canPromoteToAppeal`,
`canPromoteToExecution`). Verified by `permissions.test.ts`.

### Reminders sub-section (D-037)
| Visible to                  | Yes — every authenticated user can see/create their **own** reminders on a case they can read. |
| What is hidden              | Other users' reminders are never returned by the backend — the UI does not even attempt to ask for them. |
| Status mutation             | Only on `PENDING` rows; backend rejects all other transitions, even for the owner. |

---

## 4) Stages (`/stages/:id`)

| Action / role             | المحامي المُسنَد | غيره من STATE_LAWYER | SECTION_HEAD | BRANCH_HEAD | ADMIN_CLERK | CENTRAL | READ_ONLY | INSPECTOR |
|---|---|---|---|---|---|---|---|---|
| Read stage / progression / history | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 | 🔁 |
| **Rollover hearing** (D-024)       | 👁 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| **Finalize stage**   (D-024)       | 👁 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Hidden also when                  | `readOnly === true` OR `stageStatus ∈ {FINALIZED, ARCHIVED, PROMOTED_TO_APPEAL, PROMOTED_TO_EXECUTION}` |

### Stage attachments sub-section (D-035 / D-036) — NEW in Phase 10

| Action / role            | المحامي المُسنَد | SECTION_HEAD/ADMIN_CLERK في نفس (branch, dept) | غيرهم |
|---|---|---|---|
| List attachments         | 🛂 (read-scope D-021) | 🛂 | 🛂 |
| Download attachment      | 🛂 (per-attachment scope D-036) | 🛂 | 🛂 |
| **Upload attachment**    | 👁 | 👁 | 🚫 |

UI gating: `canUploadStageAttachment(user, stage)` in `permissions.ts`. The
membership check uses `user.departmentMemberships` (active, type SECTION_HEAD
or ADMIN_CLERK, matching `branchId` + `departmentId`). Verified by 3 new
tests in `permissions.test.ts`.

> **D-014 DIRECT_FINALIZE_CASE**: still **not** wired in the UI — backend
> supports it via `AuthorizationService` but no admin screen exists yet.

---

## 5) Execution files (`/execution-files`, `/execution-files/:id`)

| Action / role            | assignedUserId of the file | ADMIN_CLERK + ADD_EXECUTION_STEP | غيرهما |
|---|---|---|---|
| List / detail / steps    | 🔁 | 🔁 | 🔁 |
| **Add execution step** (D-031/D-032) | 👁 (open file only) | 👁 (open file only) | 🚫 |
| Hidden also when         | `status ∈ {CLOSED, ARCHIVED}` |

### Execution-file attachments sub-section (D-036) — NEW in Phase 10

| Action / role            | assignedUserId | SECTION_HEAD/ADMIN_CLERK في نفس (branch, dept) | غيرهم |
|---|---|---|---|
| List attachments         | 🛂 (D-032 ExecutionScope) | 🛂 | 🛂 |
| Download attachment      | 🛂 | 🛂 | 🛂 |
| **Upload attachment**    | 👁 | 👁 | 🚫 |

UI gating: `canUploadExecutionFileAttachment(user, file)`.

---

## 6) Resolved register (`/resolved-register`)

| Action / role | All roles |
|---|---|
| Open page    | 🔁 — D-025 scope on the server |
| Filter / sort | 🔁 — pure read-only |
| Any mutation | none — none exists |

---

## 7) Knowledge directory pages (Phase 7 + Phase 10 detail)

`/legal-library`, `/public-entities`, `/circulars` and their detail children.

| Action / role | All roles |
|---|---|
| Read list    | 👁 (D-042 — any authenticated user) |
| Read detail  | 👁 (D-042) |
| Any mutation | none — Phase 7 is read-only and Phase 10 stayed read-only (D-040 / D-041). |

---

## 8) Notifications (`/notifications`) — NEW in Phase 10

| Action / role            | All roles |
|---|---|
| Open page                | 👁 — anyone authenticated. |
| List items               | 🛂 — backend filters to `recipientUserId == actor`. |
| Mark as read             | 👁 on the user's own unread items only — `PATCH /read` on someone else's id returns 403 (surfaced inline). |
| Manually create          | 🚫 — no endpoint, no UI. |

Recipients per D-038:
- `CASE_REGISTERED` → `SECTION_HEAD` + `ADMIN_CLERK` of the case department + the initial assigned lawyer.
- `LAWYER_ASSIGNED` → the newly assigned lawyer.
- Promotions / step additions / finalization events: backend publishes them
  but **no listener** exists yet (per D-038 they are deliberately not wired).

So in practice:
- `STATE_LAWYER` → sees notifications when a case is registered to them or they're assigned.
- `SECTION_HEAD`, `ADMIN_CLERK` (active in dept) → sees `CASE_REGISTERED`.
- `BRANCH_HEAD`, `CENTRAL_SUPERVISOR`, `READ_ONLY_SUPERVISOR`, `SPECIAL_INSPECTOR` → see an **empty** `/notifications` list (intentional per D-038).

---

## 9) Things still relying purely on backend rejection (no UI gate)

The following remain "🛂 backend-only" — the UI does **not** preemptively
hide them, because doing so would require duplicating server-side scope logic
(D-021 / D-025 / D-028 / D-032 / D-036) on the client, which is explicitly
discouraged in `UI_NEXT_CHAT_CONTEXT.md` §4.

- Reading a specific case / stage / execution file that the user is out of scope for.
- Listing attachments on a stage / execution file the user is not in scope for.
- Downloading an attachment whose `attachment_scope_type` puts it outside the
  user's read scope.
- Listing reminders on a case the user has no read scope for.
- Marking a notification as read that doesn't belong to the user.

These all surface the backend's localized error message via
`extractApiErrorMessage`.

---

## 10) Things the UI hides on its own (D-024 / D-027 / D-030 / D-031 / D-032 / D-036)

- Rollover / Finalize buttons unless `assignedLawyerUserId === user.id` AND
  the stage is writable.
- Promote-to-Appeal unless `SECTION_HEAD` OR `ADMIN_CLERK + PROMOTE_TO_APPEAL`.
- Promote-to-Execution unless `SECTION_HEAD` OR `ADMIN_CLERK + PROMOTE_TO_EXECUTION`.
- Add execution step unless `assignedUserId === user.id` OR
  `ADMIN_CLERK + ADD_EXECUTION_STEP`, and the file is open.
- Stage attachment **upload** unless assigned lawyer OR active SECTION_HEAD /
  ADMIN_CLERK membership in (branch, dept).
- Execution-file attachment **upload** unless assignedUserId OR active
  SECTION_HEAD / ADMIN_CLERK membership in (branch, dept).
- Reminder status buttons unless the row is `PENDING` (the actor is always
  the owner — backend filters reads).
- "تعليم كمقروء" only on the actor's own unread notifications.

---

## 11) Out-of-scope on purpose (audit findings still open)

- **No UI for create/edit case** — Gap #4.
- **No UI for assign-lawyer** — Gap #3 (no `GET /users` with scope).
- **No UI for user / role / membership / delegation management** — admin
  screens phase, not Phase 10.
- **No UI for `DIRECT_FINALIZE_CASE` (D-014)** — admin screens phase.
- **No UI for postponement-reasons selector** — Gap #1; backend has no
  read endpoint, UI accepts the code as text.
- **No UI for `EXECUTION_STEP`-scoped attachments** — backend has no upload
  endpoint in Phase 6.

All of the above are **backend-supported** (or backend-future-work) and are
deliberately deferred to the next phase per the Phase 10 prompt.

---

## 12) Result

After Phase 10, every screen reachable from the sidebar reflects the user's
role-driven action set: the destructive / privileged buttons are hidden when
the helper says the user lacks the gate, and the backend remains the
authoritative arbiter on every call. The audit reveals **no actionable
UI-only mismatch** — every remaining "backend-only" rejection is a
deliberate consequence of D-021 / D-025 / D-028 / D-032 / D-036 scope rules
that we don't want duplicated on the client.

