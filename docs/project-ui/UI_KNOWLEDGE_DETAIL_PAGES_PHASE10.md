# UI KNOWLEDGE DETAIL PAGES — Phase 10

> Phase 10 — surfaces the **Phase 7 read-only** modules to full detail pages.
> Strictly read-only (D-040 / D-041 / D-042). No CRUD, no admin, no CMS.

---

## 1) Routes added

| Route                          | Page component                | Endpoint bound (Phase 7)          |
|---|---|---|
| `/legal-library/items/:id`     | `LegalLibraryItemDetailPage`  | `GET /api/v1/legal-library/items/{id}` |
| `/public-entities/:id`         | `PublicEntityDetailPage`      | `GET /api/v1/public-entities/{id}`     |
| `/circulars/:id`               | `CircularDetailPage`          | `GET /api/v1/circulars/{id}`           |

All three routes mount under `RequireAuth` + `AppShell` and inherit the
existing role gates (any authenticated user — D-042).

## 2) Linkage from list pages

Phase 8/9 list pages were **read-only skeletons**. Phase 10 turns each item
into a `react-router` `<Link>` to its detail page:

- `/legal-library` — title becomes `Link` → `/legal-library/items/{id}`.
- `/public-entities` — name becomes `Link` → `/public-entities/{id}`.
- `/circulars` — title becomes `Link` → `/circulars/{id}`.

## 3) Page contents

Each detail page renders:
- A `PageHeader` with title + summary.
- A "→ العودة للقائمة" ghost button.
- A spinner / inline error / "تعذّر التحميل" branch.
- A `Card` with metadata fields (`grid sm:grid-cols-2`) and the full
  `bodyText` / `detailsText` rendered with `whitespace-pre-wrap`.

Specifics per page:
- **Legal-library:** category id, source reference, published date, keywords,
  active flag, `bodyText`.
- **Public entity:** category id, reference code, keywords, active flag,
  `detailsText`.
- **Circular:** source type (mapped to Arabic via `CIRCULAR_SOURCE_LABEL_AR`),
  issue date, reference number, keywords, active flag, `bodyText`.

## 4) What was deliberately NOT added

- No edit / create / delete buttons.
- No category management UI.
- No tag/keyword editor.
- No "publish" / "draft" workflow (Phase 7 has none).
- No full-text search backend (Phase 7 uses ILIKE — D-041 — and we did not
  upgrade it).
- No file attachments on knowledge items (D-039 + D-042).

Any expansion belongs to a future admin phase + a new D-046+ decision.

## 5) Files

```
src/features/knowledge/api.ts                           # ✚ new (3 GET-by-id helpers)
src/pages/LegalLibraryItemDetailPage.tsx                # ✚ new
src/pages/PublicEntityDetailPage.tsx                    # ✚ new
src/pages/CircularDetailPage.tsx                        # ✚ new
src/pages/LegalLibraryPage.tsx                          # ✎ list rows → links
src/pages/PublicEntitiesPage.tsx                        # ✎ list rows → links
src/pages/CircularsPage.tsx                             # ✎ list rows → links
src/app/router.tsx                                      # ✎ +3 detail routes
```

No backend changes. No new decisions.

