# DEMO_VIDEO_RUN — single end-to-end demo video

A dedicated Playwright spec that walks the **entire** business lifecycle of
one freshly-created case (create → reminder → attachment → assign lawyer
→ notification → roll-over hearing → finalize → resolved-register →
promote-to-appeal → finalize the appeal → promote-to-execution → execution
action → execution-file attachment) and then logs in as **every other
role** (BRANCH_HEAD, ADMIN_CLERK with/without delegations, STATE_LAWYER
non-owner, READ_ONLY_SUPERVISOR, CENTRAL_SUPERVISOR) to demonstrate the
positive **and** negative authorisation paths — all inside **one single
test**, producing **exactly one video file** suitable for sharing as a
demo recording.

This is _separate_ from the QA-grade `roles` suite (which records one
video per scenario for diagnostics). The QA suite is unchanged.

Coverage map: `docs/project-ui/DEMO_VIDEO_COVERAGE_GAPS.md`.

---

## How to run

Pre-conditions (same as the rest of the e2e suite — see `frontend/e2e/README.md` §1):

1. Postgres reachable.
2. Spring Boot backend up on `http://localhost:8080`.
3. V22 demo seed applied (Flyway runs it on backend boot).

From `frontend/`:

```powershell
# Headless (CI / scripted recording) — generates the video
npm run test:e2e:demo

# Headed (watch live in a real Chromium window — also produces the video)
npm run test:e2e:demo:headed
```

---

## Where the single video lives

```
frontend/e2e/.artifacts/demo-results/
└── demo-00-full-system-demo-Full--96d10-tour-—-produces-ONE-video-demo/
    └── video.webm        ← the one and only video for the whole run
```

Path looks long because Playwright derives it from `<spec>-<test-title>-<project>`.
There will be **exactly one `video.webm`** under `demo-results/` per run
(Playwright wipes the folder before each run via `outputDir`).

To convert to mp4 (optional, requires ffmpeg):

```powershell
ffmpeg -i .\e2e\.artifacts\demo-results\demo-00*\video.webm `
       -c:v libx264 -crf 23 -preset medium .\demo-final.mp4
```

---

## What the video shows (in order)

The spec walks ONE freshly-created case through the entire business
lifecycle, then logs in as every other role to demonstrate gating.

| #  | Role / Scene                               | Demonstrated flow |
|----|--------------------------------------------|-------------------|
| 1  | (anonymous)                                | wrong-password failure → forgot-password page → protected-route redirect |
| 2  | SECTION_HEAD `section_fi_dam`              | cases list → create-case (validation error → real submit) → edit-basic-data modal (cancel) → **assign lawyer** → **create reminder** → open new stage → **upload attachment** |
| 3  | STATE_LAWYER `lawyer_fi_dam` (assigned)    | notifications inbox (mark read) → open own case → open stage → **upload attachment** → **REAL roll-over** (date + reason) → **REAL finalize** (decision number/date/type/amount/currency/summary) |
| 4  | SECTION_HEAD again                         | resolved-register filtered to year/month → open the finalized case → **REAL promote-to-APPEAL** → re-assign lawyer on the appeal stage |
| 4b | STATE_LAWYER (appeal stage owner)          | finalize the APPEAL stage |
| 4c | SECTION_HEAD                               | **REAL promote-to-EXECUTION** (modal with full body) → opens the new ExecutionFile |
| 4d | SECTION_HEAD                               | **add ExecutionAction** + **upload execution-file attachment** |
| 5  | ADMIN_CLERK `clerk_fi_dam` (with delegations) | resolved-register → open Case 3 (pre-finalized) → execution files list + #1 detail |
| 6  | ADMIN_CLERK `clerk2_fi_dam` (no delegation) | open the demo case — **proves** assign-lawyer section is hidden |
| 7  | STATE_LAWYER `lawyer2_fi_dam` (non-owner)  | open the demo case — proves no write surface for foreign lawyer |
| 8  | BRANCH_HEAD `head_dam`                     | branch-scoped reads of cases / register / execution-files |
| 9  | READ_ONLY_SUPERVISOR `viewer`              | cases (read) → resolved-register → legal-library **drill-into item** → public-entities **drill-into entity** → circulars **drill-into circular** |
| 10 | CENTRAL_SUPERVISOR `admin`                 | dashboard → profile → /admin/users (filter role + active) → **create user** → tour 5 admin sections → add+remove role → **add membership** → **grant + toggle delegated permission** → **grant + revoke court access** (covers the bug fixed on 2026-04-19) → **PATCH user** (deactivate + reactivate) |
| 12 | (cleanup)                                  | logout via the real header button |

A small `slowMo: 250 ms` is configured on the `demo` Playwright project
(plus inline pauses) so the video reads naturally rather than blinking
through screens. Per-test timeout is 25 minutes.

---

## What is intentionally NOT shown (documented gaps)

These are skipped on purpose — the spec does **not** fake them. They are
already documented in `docs/project-ui/UI_RUNTIME_BUGS_FOUND.md`,
`docs/project-ui/DEMO_VIDEO_COVERAGE_GAPS.md` §4 and the QA suite (`roles/99-known-gaps.spec.ts`).

### Environment / seed exclusions (will not be added — would be misleading)
| Item | Reason |
|---|---|
| Reset-password OTP loop | OTP printed only to backend log (ENV-LIMIT-002) |
| Attachment authenticated download | Local-FS storage gap (KNOWN-GAP-004 / D-035) |
| `localStorage → httpOnly` cookie migration | Post-pilot hardening (KNOWN-GAP-003 / D-044) |
| SPECIAL_INSPECTOR journey | No seeded account in V20–V22 |
| Rollover / finalize submit on the V22-**seeded** cases | Would mutate shared seed and break re-runs — instead the video creates its own fresh case in scene 2 and submits real rollover/finalize on **that** case in scenes 3–4 |
| Promote-to-execution on V22-seeded Case 4 | Already promoted by the seed — instead the video promotes the **freshly-created** case in scene 4c |

### Surfaces that simply aren't built yet (would falsify the demo if faked)
| Item | Reason |
|---|---|
| Reports module (FUNCTIONAL_SCOPE §1.16) | No UI route built — backend reports endpoints not surfaced |
| Audit log viewer (§1.17) | No UI route built |
| "شاشة جلسات اليوم" / Today's hearings (§1.5) | No dedicated page yet |
| Self-service change-password on `/profile` | Page is read-only today |
| Reset-password / lock-unlock on `/admin/users` | Only PATCH (active / fullName / mobileNumber) is shipped — toggling `active=false` IS demoed in scene 10 as the available substitute |

If a defensive branch fails (e.g. a button is not surfaced because the
preceding state was already mutated by a prior re-run), the spec logs
`(... — non-fatal.)` and continues without failing the whole video.

---

## Configuration reference

`playwright.config.ts` — `projects` entry `demo`:

```ts
{
  name: 'demo',
  testMatch: ['**/demo/**/*.spec.ts'],
  outputDir: './e2e/.artifacts/demo-results',
  timeout: 25 * 60_000,
  use: {
    ...devices['Desktop Chrome'],
    video: 'on',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { slowMo: 250 },
  },
}
```

The default `chromium` and `roles` projects exclude `**/demo/**`, so
running `npm run test:e2e` or `npm run test:e2e:roles` will **not**
trigger the demo (and won't produce extra videos).

