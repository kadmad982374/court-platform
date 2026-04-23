# DEMO_SEED_RUNTIME_VERIFICATION.md
## تقرير التحقق من بيانات الديمو بعد V22

> **Date:** 2026-04-18  
> **Method:** API-level testing (curl.exe) against live backend with V22 migration applied  
> **Backend log confirms:** `V22 demo seed complete` — all 4 cases + execution file + court access created

---

## BUG-003 Status: ✅ CLOSED

| Before V22 | After V22 |
|------------|-----------|
| `POST /cases/{id}/assign-lawyer` → `FORBIDDEN: Lawyer has no active access to the case court` | `POST /cases/{id}/assign-lawyer` → ✅ `200 OK`, `currentOwnerUserId:5`, `lifecycleStatus:ACTIVE` |

**Root cause fixed:** `user_court_access` records added for `lawyer_fi_dam` (court 2), `lawyer2_fi_dam` (court 2), `lawyer_app_dam` (court 3).

---

## Verification Matrix

| # | Flow | Result | Details |
|---|------|--------|---------|
| 1 | Login (4 users) | ✅ PASS | section, lawyer, admin, viewer |
| 2 | Assignable lawyers list | ✅ PASS | 2 active lawyers, inactive excluded |
| 3 | **Assign lawyer (BUG-003)** | ✅ **PASS** | Case 1 assigned, owner set, status→ASSIGNED |
| 4 | Lawyer sees assigned cases | ✅ PASS | 4 cases visible after V22 seed |
| 5 | Stage progression | ✅ PASS | Previous + current hearing dates correct |
| 6 | Hearing history | ✅ PASS | INITIAL + ROLLOVER entries |
| 7 | **Rollover hearing** | ✅ **PASS** | New ROLLOVER entry created (id=12) |
| 8 | **Finalize stage** | ✅ **PASS** | Decision D-V22-TEST created, FOR_ENTITY, 250,000 SYP |
| 9 | **Resolved register (April)** | ✅ **PASS** | 2 entries: Cases 3+4 with amounts |
| 10 | **Resolved register (June)** | ✅ **PASS** | 1 entry: Case 2 (just finalized) |
| 11 | **Promote to appeal** | ✅ **PASS** | Case 3 → IN_APPEAL, newAppealStageId=8 |
| 12 | Execution files list | ✅ PASS | 1 file (EX-DEMO-004) |
| 13 | Execution file detail | ✅ PASS | Full details returned |
| 14 | Execution steps list | ✅ PASS | 2 steps (NOTICE_REQUEST + NOTICE_ISSUED) |
| 15 | **Add execution step** | ✅ **PASS** | Step 3 (PAYMENT_RECORDED) added |
| 16 | Stage attachments | ✅ PASS | 1 attachment listed (مذكرة_دفاع.txt) |
| 17 | Reminders | ✅ PASS | 1 PENDING + 1 DONE |
| 18 | Notifications (section) | ✅ PASS | 6 notifications (mix of read/unread) |
| 19 | Notifications (lawyer) | ✅ PASS | 3 LAWYER_ASSIGNED (mix of read/unread) |
| 20 | Legal library | ✅ PASS | 7 items, paginated |
| 21 | Public entities | ✅ PASS | 9 entities |
| 22 | Circulars | ✅ PASS | 4 circulars |

**Result: 22/22 PASS — 100% of tested flows succeed.**

---

## Flows Previously BLOCKED (in E2E audit) — Now Open

| Flow | Previous Status | Current Status |
|------|---------------|----------------|
| Assign lawyer | ❌ FAIL (BUG-003) | ✅ PASS |
| Rollover hearing | ⏭️ BLOCKED | ✅ PASS |
| Finalize stage | ⏭️ BLOCKED | ✅ PASS |
| Resolved register (with data) | 🔶 PARTIAL (empty) | ✅ PASS (3 entries) |
| Promote to appeal | ⏭️ BLOCKED | ✅ PASS |
| Execution files + steps | ⏭️ BLOCKED | ✅ PASS |
| Add execution step | ⏭️ BLOCKED | ✅ PASS |

---

## Remaining Limitations

| Item | Type | Notes |
|------|------|-------|
| Browser UI navigation | Environment limitation | No Playwright in agent — API-only verification |
| Attachment download | Environment limitation | Need browser blob |
| Promote-to-execution (API) | Not tested this session | Case 4 was pre-built in execution state; API for promote needs body fields |
| Attachment file on disk | Seed metadata only | demo attachment records exist in DB but no actual files on disk — upload via UI will work |

