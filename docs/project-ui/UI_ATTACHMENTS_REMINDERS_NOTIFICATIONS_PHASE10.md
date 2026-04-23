# UI ATTACHMENTS / REMINDERS / NOTIFICATIONS — Phase 10

> Phase 10 of the project. Goal: bind the remaining Phase 6 backend
> (attachments + personal reminders + internal notifications) into the
> existing UI, **without** touching backend contracts.
>
> **Backend untouched.** Zero migrations, zero new endpoints, zero contract changes.

---

## 1) Scope (in)

- **Attachments** (D-035 / D-036) — reusable `AttachmentsSection` mounted as a
  child section of:
  - `StageDetailPage`           → scope `CASE_STAGE`
  - `ExecutionFileDetailPage`   → scope `EXECUTION_FILE`
  Bound endpoints:
  - `POST /api/v1/stages/{stageId}/attachments`           (multipart `file`)
  - `GET  /api/v1/stages/{stageId}/attachments`
  - `POST /api/v1/execution-files/{id}/attachments`        (multipart `file`)
  - `GET  /api/v1/execution-files/{id}/attachments`
  - `GET  /api/v1/attachments/{id}/download`               (authenticated XHR → blob)

- **Reminders** (D-037) — `RemindersSection` mounted as a child of
  `CaseDetailPage`. Personal-only (backend filters to current user). Bound:
  - `POST  /api/v1/cases/{id}/reminders`
  - `GET   /api/v1/cases/{id}/reminders`
  - `PATCH /api/v1/reminders/{id}/status`  (`PENDING → DONE` or `PENDING → CANCELLED`)

- **Notifications** (D-038) — top-level page `/notifications`. Bound:
  - `GET   /api/v1/notifications?page=&size=`
  - `PATCH /api/v1/notifications/{id}/read`

- **Knowledge detail pages** (Phase 7 read-only, D-042) — see
  `UI_KNOWLEDGE_DETAIL_PAGES_PHASE10.md`.

- **Permissions helpers** (D-036) — `canUploadStageAttachment` and
  `canUploadExecutionFileAttachment` added to `features/auth/permissions.ts`.

---

## 2) Scope (out — explicit)

- **No** DELETE/PUT for attachments, no versioning (D-036 forbids).
- **No** shared / team-wide reminders (D-037 says personal-only).
- **No** manual `POST /notifications` (D-038 forbids — listeners only).
- **No** scheduler, push, email, websocket, batching, digest (D-039).
- **No** anti-virus / quarantine (out of scope per Phase 6).
- **No** `EXECUTION_STEP`-scoped attachments via UI — backend has the column
  but no upload endpoint exposed in Phase 6.
- **No** create/edit/delete for legal-library / public-entities / circulars —
  Phase 7 is read-only by D-042 and Phase 10 stays read-only (D-040, D-041).
- **No** sidebar entries for `/attachments` or `/reminders` — these live as
  sections inside their host pages on purpose (test enforces this).

---

## 3) UI surface (what the user sees)

| Mount point                     | Section / Page                          | Effects |
|---|---|---|
| `CaseDetailPage` (`/cases/:id`) | **`RemindersSection`**                  | Personal reminders: list, create (datetime + text ≤500), mark `DONE` / `CANCELLED`. Hidden from sharing — backend returns only the actor's. |
| `StageDetailPage` (`/stages/:id`) | **`AttachmentsSection scope="STAGE"`** | List + upload (button hidden if `canUploadStageAttachment === false`) + per-row download. |
| `ExecutionFileDetailPage` (`/execution-files/:id`) | **`AttachmentsSection scope="EXECUTION_FILE"`** | Same UX, scoped to the execution file. |
| Sidebar → "عام" → **الإشعارات** | **`NotificationsPage`** at `/notifications` | List with unread highlight, "تعليم كمقروء" per item, simple page/size pager. |

### Upload constraints honored client-side
- File size > 50 MB → hard-rejected before sending (`FILE_TOO_LARGE` mirror).
- Authorization header (Bearer) is preserved on every request including the
  multipart upload and the binary download. Download triggers a blob URL — we
  do **not** use a raw `<a href>` because the bearer token would not travel.

---

## 4) Permissions (D-036) honored visually

The new helpers are conservative client-side hints; backend re-checks D-036
unconditionally on every call.

```
canUploadStageAttachment(user, stage):
  user.id === stage.assignedLawyerUserId
  OR user has an ACTIVE membership of type SECTION_HEAD / ADMIN_CLERK
     in (stage.branchId, stage.departmentId)

canUploadExecutionFileAttachment(user, file):
  user.id === file.assignedUserId
  OR user has an ACTIVE membership of type SECTION_HEAD / ADMIN_CLERK
     in (file.branchId, file.departmentId)
```

If the helper returns `false`, the UI shows: *"لا تملك صلاحية رفع المرفقات على
هذا النطاق (D-036)."* — list/download remain available subject to backend
read-scope.

Reminders: backend filters reads to `ownerUserId == actor`; UI never tries to
list other users' reminders. Status update is offered only on `PENDING` rows
because the backend rejects all other transitions (no re-open per D-037).

Notifications: backend filters reads to `recipientUserId == actor`; UI offers
"تعليم كمقروء" only for the actor's unread items. Cross-user `PATCH .../read`
returns 403 → surfaced inline.

---

## 5) Files added in Phase 10 (UI only)

```
src/
  features/
    attachments/                       # ✚ new
      api.ts                                  # 5 endpoints + auth-aware download
      AttachmentsSection.tsx                  # reusable section (STAGE | EXECUTION_FILE)
    reminders/                         # ✚ new
      api.ts                                  # 3 endpoints
      RemindersSection.tsx                    # mounted in CaseDetailPage
    notifications/                     # ✚ new
      api.ts                                  # 2 endpoints
      NotificationsPage.tsx                   # /notifications route
    knowledge/                         # ✚ new
      api.ts                                  # 3 GET-by-id helpers (Phase 7 modules)
  pages/
    LegalLibraryItemDetailPage.tsx     # ✚ new
    PublicEntityDetailPage.tsx         # ✚ new
    CircularDetailPage.tsx             # ✚ new

src/features/auth/permissions.ts        # ✎ +D-036 helpers (2 new)
src/features/auth/permissions.test.ts   # ✎ +5 D-036 tests + Membership-aware factory
src/features/navigation/navItems.ts     # ✎ +/notifications (section "عام")
src/features/navigation/navItems.test.ts# ✎ updated forbidden-set + new assertion
src/app/router.tsx                      # ✎ +/notifications + 3 detail routes
src/shared/types/domain.ts              # ✎ +Attachment / Reminder / Notification types
src/features/cases/CaseDetailPage.tsx   # ✎ mount RemindersSection (and fix pre-existing ReactNode import)
src/features/cases/StageDetailPage.tsx  # ✎ mount AttachmentsSection (STAGE)
src/features/execution/ExecutionFileDetailPage.tsx # ✎ mount AttachmentsSection (EXECUTION_FILE)
src/features/execution/ExecutionFilesPage.tsx     # ✎ pre-existing Phase 9 ReactNode bug fix
src/features/resolvedregister/ResolvedRegisterPage.tsx # ✎ pre-existing Phase 9 ReactNode bug fix
src/pages/LegalLibraryPage.tsx          # ✎ list rows → links
src/pages/PublicEntitiesPage.tsx        # ✎ list rows → links
src/pages/CircularsPage.tsx             # ✎ list rows → links
```

---

## 6) Backend impact

**Zero.** No migrations, no new endpoints, no contract changes, no Phase 6
listener changes. All Phase 6/7 contracts consumed as-is.

---

## 7) Build & test verification

Run inside `frontend/`:

```
npm install
npm run lint
npm run build      # tsc -b && vite build
npm run test       # vitest run
```

In this session:
- `npm run build` → **BUILD SUCCESS** (`vite v5.4.21 — built in 3.31s`,
  `dist/index.html + assets/*` produced).
- `npm test -- --run` → **17 / 17 tests passed**.
  (2 "Failed Suites" warnings come from pre-existing **empty** Phase 8
  placeholder files `RequireAuth.test.tsx` and `tokenStorage.test.ts` — they
  contain no test cases. Pre-existing, untouched in Phase 10.)

---

## 8) Gaps still open (per Phase 9 §5, status updated)

- **Gap #1** — No public `GET /api/v1/postponement-reasons` endpoint.
  **Status:** unchanged. UI still accepts the reason code as text and surfaces
  the backend rejection inline. Phase 10 did **not** add a backend endpoint.
- **Gap #3** — No `GET /users` with scope ⇒ no assign-lawyer UI.
  **Status:** unchanged, deferred to admin screens (next phase).
- **Gap #4** — No create/edit case UI.
  **Status:** unchanged, deferred to admin screens (next phase).
- **Gap #5** — Node availability in the agent environment.
  **Status:** RESOLVED in this session. `npm run build` and `npm test -- --run`
  executed locally and both succeeded.

---

## 9) Decisions

**No new D-046+** in Phase 10. All bindings rely on existing D-035 / D-036 /
D-037 / D-038 / D-040 / D-041 / D-042. The permission helpers and the upload-
visibility heuristic implement D-036 conservatively — backend is still the
ultimate authority.

