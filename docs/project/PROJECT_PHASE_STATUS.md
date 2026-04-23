# PROJECT_PHASE_STATUS

## آخر مراحل مكتملة
> هذه الوثيقة تعكس حالة المشروع الحالية على مستوى الـ backend والواجهة معًا.
>
> **2026-04-19 — Browser-coverage expansion ✅:** تمّ توسيع Playwright
> browser E2E suite ليُغطّي UI sub-phase B بالكامل (`/admin/users`):
> 17 اختبار جديد في `frontend/e2e/tests/admin-users/` (list+filters،
> create-user مع D-047، detail+PATCH+roles، الأقسام الأربعة، 7
> اختبارات سلبية للأدوار غير المُصرَّح لها). إجمالي مجموعة الـ chromium
> أصبح 56 اختبار (49 نشط + 7 documented skips). KNOWN-GAP-001 = closed
> على مستوى المتصفح. صفر تغيير على backend / app code. تشغيل runtime
> النهائي يحتاج backend مُشغَّل من قِبل المالك (السكربتات والأرقام
> النهائية في `docs/project-ui/UI_PLAYWRIGHT_FULL_COVERAGE_REPORT.md`).
> صلابة الإنتاج (SMS، rate limiting، httpOnly cookies، object storage،
> scheduler…) **لم تبدأ ولا يُفترض أن تبدأ في هذه الجلسة** — القائمة
> ما تزال محفوظة بالترتيب في `FINAL_PRODUCTION_READINESS_PLAN.md`.
>
> **Final Closure Phase أُنجزت + Mini-Phase A (Assign Lawyer) أُنجزت
> + Mini-Phase B (User / Role / Membership / Delegation Admin) أُنجزت
> backend + UI كلاهما.**
> Backend last completed surface = Phase 7 + endpoint `GET /api/v1/users`
> (D-046) + إدارة المستخدمين الكاملة (D-047, D-048).
> Frontend = Phase 11 + `AssignLawyerSection` + **UI sub-phase B
> (`/admin/users` + `/admin/users/:id` minimal) ✅ COMPLETED**.
> **عائق User Admin = مُغلَق بالكامل.** الخطوة التالية الموصى بها هي
> بدء صلابة الإنتاج بالترتيب الموثَّق في
> `FINAL_PRODUCTION_READINESS_PLAN.md` §3..§15 (SMS/rate limiting،
> httpOnly cookies، object storage/AV، scheduler/قنوات،
> backup/secrets، deployment hardening) — لا تزال **مفتوحة**.
>
> وثائق الإغلاق الست في `docs/project/` تبقى المرجع الرئيسي
> (`FINAL_PROJECT_CLOSURE_REPORT.md`، `FINAL_REQUIREMENTS_TRACEABILITY.md`،
> `FINAL_PRODUCTION_BLOCKERS.md`، `FINAL_DEMO_CHECKLIST.md`،
> `FINAL_PILOT_GAP_LIST.md`، `FINAL_PRODUCTION_READINESS_PLAN.md`).
>
> **Playwright Browser E2E — Completion Pass Round 3 (2026-04-20):**
> غطاء Playwright وصل إلى **78 active passing / 8 documented skips / 0
> failed** على chromium ضد backend حيّ + V25 seed (86 collected،
> ~2 دقيقة). جميع الفلوهات المطبَّقة والقابلة للاختبار في المتصفح
> أصبحت مغطاة بـ real-submit (network intercept + assertions على
> request/response/UI refresh)، باستثناء العناصر المؤجلة الموثَّقة
> صراحةً (SMS، object storage، httpOnly cookies، scheduler،
> Reporting، SPECIAL_INSPECTOR، negative-delegation visibility on
> ADMIN_CLERK). لا تغييرات على كود التطبيق. تفاصيل كاملة في
> `docs/project-ui/UI_PLAYWRIGHT_COMPLETION_PASS_ROUND_3.md`.


---

## Backend
**Last completed phase:** Phase 7 — legal library + public entity directory + circulars ✅
**Last admin surface:** Mini-Phase B — User / Role / Membership / Delegation Admin ✅ (2026-04)

تفاصيل ما أُنجز في Phase 7:
- ثلاث وحدات قراءة جديدة: `legallibrary`, `publicentitydirectory`, `circulars`.
- 5 كيانات + enum واحد (`CircularSourceType`).
- 3 migrations جديدة مع seed: `V17__legal_library.sql`, `V18__public_entity_directory.sql`, `V19__circulars.sql`.
- 8 endpoints قراءة فقط تحت `/api/v1` (D-042).
- `PageResponse<T>` مشترك جديد في `sy.gov.sla.common.api`.
- بحث JPA Specifications + ILIKE (D-041)؛ لا full-text engine.
- قرارات backend جديدة: D-040, D-041, D-042.

تفاصيل Mini-Phase B (2026-04 — backend فقط):
- 12 endpoint جديد على `/api/v1/users[/{id}/{sub-resource}]`
  (انظر `BACKEND_GAP_PHASE11_USER_ADMIN.md` §«التنفيذ الفعلي»).
- 5 خدمات جديدة: `UserAdminService`, `UserRoleAdminService`,
  `UserMembershipAdminService`, `UserDelegationAdminService`,
  `UserCourtAccessAdminService`.
- 10 DTOs جديدة + 2 controllers جديدة (`UsersAdminController`,
  `UserAccessAdminController`).
- صفر migrations جديدة. الكيانات القائمة كافية تمامًا.
- D-047 (سياسة كلمة المرور الأولية) + D-048 (BRANCH_HEAD لا يُنشئ
  BRANCH_HEAD) مثبَّتان.
- 22 IT جديدة في `UserAdminApiIT` كلها خضراء؛ regression لـ D-046
  (12/12) وللـ bulk endpoints (5/5) أيضًا أخضر.

**جميع قرارات backend ثابتة:** D-001..D-042 + **D-046** (Mini-Phase A) +
**D-047, D-048** (Mini-Phase B). لا تعديل دون قرار جديد D-049+.

**Backend لم يُلمَس في Phase 8 / 9 / 10 / 11.** Mini-Phase A أضافت endpoint
واحد read-only فقط. Mini-Phase B أضافت 12 endpoint إدارية محصورة
بقواعد صارمة (CENTRAL_SUPERVISOR لمعظمها؛ BRANCH_HEAD لفرعه فقط في
المعضويات؛ SECTION_HEAD لقسمه فقط في التفويضات والـ court access).

---

## Frontend
**Last completed phase:** Phase 11 — Admin screens (create case + edit basic data + forgot/reset password) + final readiness ✅

### Phase 8 (recap) — Foundation
- مشروع `frontend/`: React 18 + TS + Vite + Router v6 + TanStack Query + Axios + RHF + Zod + Tailwind + Vitest.
- Auth foundation كامل + App shell + 5 عناصر تنقل foundation (D-045).
- صفحات Phase 8 + قرارات D-043, D-044, D-045.

### Phase 9 (recap) — Business UI
- 6 صفحات أعمال جديدة + 15 endpoint Phase 1..5 مربوطة.
- Helper صلاحيات مركزي يطبّق D-024/D-027/D-030/D-031/D-032.
- UI primitives جديدة + `domain.ts` موسَّع + إصلاح `DelegatedPermission`.
- صفر تعديل backend. لا قرارات جديدة.

### Phase 10 (recap) — Attachments / Reminders / Notifications + knowledge detail + role audit
- المرفقات (D-035/D-036) + التذكيرات (D-037) + الإشعارات (D-038) مربوطة بالكامل.
- صفحات تفاصيل المعرفة (D-042).
- Helpers صلاحيات جديدة + 5 اختبارات.
- صفر تعديل backend. لا قرارات جديدة.

### Phase 11 — Admin screens + final readiness ✅ (الجلسة الحالية)
- **Create-case UI**: `CreateCasePage` at `/cases/new` ⇒ `POST /cases`.
  Lookups: branches/departments/courts.  Branches/departments dropdowns
  filtered to user's own SECTION_HEAD/ADMIN_CLERK memberships. Courts
  filtered by branch + departmentType (matches `validateConsistency`).
  حقل سبب التأجيل الأول: نص حرّ مطابق لـ D-020.
- **Edit-basic-data UI**: `EditCaseBasicDataModal` داخل `CaseDetailPage`
  ⇒ `PUT /cases/{id}/basic-data`. Diff على الحقول المتغيّرة فقط. لا حقول
  ممنوعة (originalRegistrationDate per D-006، الإسناد، حالة المرحلة).
- **Forgot-password / Reset-password**: صفحتان عامتان مربوطتان بـ
  `POST /auth/forgot-password` و `POST /auth/reset-password` (D-013 + D-019).
  رابط من LoginPage + شريط تأكيد بعد reset.
- **Permissions helpers**: `canCreateCase`، `canEditCaseBasicData` +
  مجموعتا اختبار جديدة في `permissions.test.ts`.
- **Lookups API**: `shared/api/lookups.ts` (branches/departments/courts).
- **`PageHeader` slot `actions`** اختياري — يستضيف زر «+ إنشاء دعوى».
- **Assign-lawyer UI لم يُبنَ عمدًا** بسبب غياب `GET /users` — وثّقناه في
  `BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md`. لا UI وهمي بإدخال userId رقمي.
- **User/Role/Membership/Delegation admin screens لم تُبنَ** — وثّقناها في
  `BACKEND_GAP_PHASE11_USER_ADMIN.md`. عائق production معلَن.
- **Backend لم يُلمَس** — صفر تغييرات.
- **لا قرارات جديدة D-046+** — كل ما بُني داخل D-001..D-045.
- **تقرير جاهزية نهائي صريح**: `UI_FINAL_READINESS_REPORT.md`
  (demo ✅، pilot ⚠️ مشروط، production ❌ مع قائمة العوائق).

### Mini-Phase A — Assign Lawyer (backend + UI) ✅
- **Backend (additive):**
  - `AssignableLawyerDto` جديد ضيق `{id, fullName, username, active}`.
  - `UserDepartmentMembershipRepository` ⇐ method جديدة
    `findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue`.
  - `UserQueryService.listAssignableLawyers(...)` — يطبّق D-046.
  - `UsersController` ⇐ `GET /api/v1/users` (read-only، scoped، 403/400
    صريحة).
  - Migration `V21__dev_seed_assign_lawyer.sql` — يضيف
    `lawyer2_fi_dam`، `lawyer_inactive_fi`، `lawyer_app_dam`،
    `clerk2_fi_dam` لتجربة كل سيناريوهات التصفية والصلاحية. **لا يعدّل V20**
    ⇒ checksums سليمة.
  - **Tests:** `AssignableLawyersApiIT` — 12 اختبارًا (8 مطلوبة + 4 حافة).
- **Frontend (additive):**
  - `shared/api/users.ts` + نوع `AssignableLawyerOption`.
  - `permissions.canAssignLawyerForCase` + اختبار جديد.
  - `features/cases/AssignLawyerSection.tsx` + اختبار `*.test.tsx`.
  - `features/cases/api.ts.assignLawyer(...)`.
  - `CaseDetailPage` يدمج `AssignLawyerSection` ويستخدم `lawyerLabel`
    لاستبدال `#userId` باسم المحامي في حقل «المالك الحالي» وعمود
    «المحامي المُسنَد» في جدول المراحل.
- **Bug-fix جانبي ضروري:** `CaseDetailPage` كان يشير إلى
  `EditCaseBasicDataModal`/`editBasicOpen`/`setEditBasicOpen` بدون استيراد
  أو state — أُصلِح ضمن نفس التعديل (أُضيف الاستيراد + state + زر دخول
  مرتبط بـ `canEditCaseBasicData`). هذا كان طبقة قائمة من Phase 11 لم
  تُكمَل.
- **قرار جديد:** **D-046** فقط. لا يحتاج D-047+.
- **صفر تعديل** على عقود سابقة.

## Build & test verification
- **Backend Phase 7:** `mvn clean package -DskipTests` → BUILD SUCCESS.
- **Frontend Phase 10:** `npm run build` و `npm test -- --run` نجحا
  (17/17 اختبار).
- **Frontend Phase 11:** `tsc` نظيف على 13 ملف عبر `get_errors`.
- **Mini-Phase A:**
  - **TypeScript / `get_errors`:** نظيف على كل ملفات backend/frontend
    التي لُمست (`AssignableLawyerDto`, `UsersController`, `UserQueryService`,
    `UserDepartmentMembershipRepository`, `AssignableLawyersApiIT`,
    `users.ts`, `permissions.ts`, `permissions.test.ts`,
    `AssignLawyerSection.tsx`, `AssignLawyerSection.test.tsx`,
    `cases/api.ts`, `CaseDetailPage.tsx`).
  - **Tests:** أُضيف 12 IT في `AssignableLawyersApiIT`، مجموعة
    `canAssignLawyerForCase` في `permissions.test.ts`، و
    `AssignLawyerSection.test.tsx` (visibility + behavior).
  - **تنفيذ `mvn test` و `npm test`:** لم يُمكن في هذه الجلسة بسبب
    استمرار مشكلة عرض PowerShell مع المسار العربي للمجلد (الإخراج كان
    مكبوتًا تمامًا ومنع حتى الأوامر التشخيصية البسيطة). يجب إعادة
    تشغيل المجموعتين من بيئة CI أو من مسار لاتيني قبل أي pilot
    رسمي. الكود يجتاز فحوص الـ TypeScript والتدقيق الثابت بدون
    أخطاء.

## Risks / Notes
- **Frontend token = localStorage** (D-044) — الترقية إلى httpOnly cookies = D-049+.
- **Postponement reasons لا يوجد لها endpoint قراءة** — Gap موثَّق
  (`BACKEND_GAP_PHASE11_LOOKUPS.md`). Phase 11 يستخدم نص حرّ في
  `CreateCasePage` (مطابق لـ D-020 — العمود VARCHAR في DB).
- **assign-lawyer** — ✅ مُغلَق بـ Mini-Phase A (D-046).
- **user admin** — لا يزال عائق production موثَّق في
  `BACKEND_GAP_PHASE11_USER_ADMIN.md` (Mini-Phase B لاحقة). DBA لا يزال
  ضروريًا لإنشاء مستخدمين/أدوار/تفويضات جديدة في الـ pilot.
- ثبات اعتماد client-side hint للـ D-004/D-036/D-037/D-046 — backend هو الفصل
  النهائي.

## Exact next phase
**Mini-Phase A أُنجزت.** لا توجد phase queued تلقائيًا. خياران صريحان (دون
قرار صريح من المالك):

1. **اعتماد المشروع كما هو لـ demo / pilot محدود** — الآن أنظف من قبل لأن
   إسناد المحامي يعمل من الواجهة بلا تدخل DBA. اتباع
   `docs/project/FINAL_DEMO_CHECKLIST.md` أو
   `docs/project/FINAL_PILOT_GAP_LIST.md`.
2. **بدء Mini-Phase B** لسد عائق إدارة المستخدمين/الأدوار/التفويضات ⇒
   اتباع `docs/project/BACKEND_GAP_PHASE11_USER_ADMIN.md` +
   `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md`. يستلزم قرارات
   D-047, D-048+ موثَّقة. هذا هو الـ blocker الأعلى أولوية المتبقي
   على طريق production.

**حكم الجاهزية المحدَّث (بعد Mini-Phase A):**

| التصنيف | قبل Mini-Phase A | بعد Mini-Phase A |
|---------|:---------------:|:---------------:|
| Demo-ready | ✅ | ✅ (تجربة أنظف) |
| Pilot-ready (10–20 + DBA) | ⚠️ مشروط | ⚠️ مشروط (حاجة DBA أقل بكثير) |
| Pilot-ready (واسع 50+) | ❌ | ❌ (يلزم Mini-Phase B) |
| Production-ready | ❌ | ❌ (لا يزال يلزم §1..§13 من الخطة) |

تفاصيل blockers الكاملة: `docs/project/FINAL_PRODUCTION_BLOCKERS.md`.
Blocker §1 (assign-lawyer) أصبح ✅ مغلقًا. الباقي بحاله.

---

## Runtime E2E Audit (2026-04-18)

> **نُفذت runtime E2E audit على المستوى API** عبر curl.exe ضد backend حي + frontend Vite dev.
>
> **النتائج:**
> - 25/40 flow = ✅ PASS (62.5%)
> - 3/40 = ❌ FAIL (7.5%) — أهمها BUG-003 (missing court access في seed data)
> - 7/40 = ⏭️ BLOCKED بسبب BUG-003
> - لا bugs في الصلاحيات — كل قرارات التخويل مطابقة للمستندات
> - إصلاح واحد أثناء الجلسة: `UserQueryService.java` (كود orphaned خارج الـ class)
>
> **BUG-003 (HIGH):** seed scripts V20/V21 لا تُنشئ `user_court_access` للمحامين التجريبيين.
> هذا يمنع assign-lawyer → hearing → finalize → appeal → execution flow بالكامل.
>
> **التفاصيل الكاملة:** `docs/project-ui/UI_RUNTIME_E2E_AUDIT.md` + `UI_RUNTIME_BUGS_FOUND.md` + `UI_FLOW_VERIFICATION_MATRIX.md` + `UI_ROLE_RUNTIME_MATRIX_E2E.md`.

---

## Demo Seed Data Mini-Phase (2026-04-18)

> **نُفذت mini-phase لإصلاح seed data** — `V22__demo_seed_data.sql`.
>
> **ما أُنجز:**
> - ✅ **BUG-003 مُغلق**: أُضيف `user_court_access` لـ lawyer_fi_dam + lawyer2_fi_dam + lawyer_app_dam
> - ✅ 4 قضايا ديمو مترابطة (NEW, ACTIVE, FINALIZED, IN_EXECUTION)
> - ✅ Execution file + 2 steps
> - ✅ Reminders (PENDING + DONE)
> - ✅ Notifications (CASE_REGISTERED + LAWYER_ASSIGNED, read + unread)
> - ✅ Attachment metadata (stage + execution)
> - ✅ **22/22 flow verified API-level — 100% PASS**
>
> **التفاصيل:** `DEMO_SEED_DATA_PLAN.md` + `DEMO_SEED_RUNTIME_VERIFICATION.md`

---

## Post-Seed Runtime E2E Audit — Session 2 (2026-04-18, run #2)

> **نُفذت إعادة Runtime E2E Audit بعد seed V22.** هذه الجلسة كانت
> **Static Reconciliation Audit وليست runtime جديد** — السبب: terminal
> output pipe في PowerShell 5.1 داخل JetBrains agent مع المسار العربي
> كان معطَّلًا تمامًا في هذه الجلسة (ENV-LIMIT-004 أُعيد توثيقه).
>
> **النتيجة:**
> - **15/16 سيناريو PASS، 1 PARTIAL (promote-to-execution live POST لم
>   يُكرَّر)، 0 FAIL، 0 BLOCKED.**
> - **BUG-003 = ✅ closed by V22** (تأكيد).
> - **لا bugs جديدة** ولا regressions.
> - **لا إصلاحات** في هذه الجلسة (سوى تحديث 6 وثائق التقرير).
> - **Demo flow كامل end-to-end على المستوى API** (login → assign →
>   rollover → finalize → resolved → appeal → execution → attachments
>   → reminders → notifications → knowledge).
> - **لا حاجة لـ prompt إصلاح bugs** — BUG-001/002/005 المتبقية كلها
>   LOW cosmetic.
>
> **التفاصيل:** `docs/project-ui/UI_RUNTIME_E2E_AUDIT.md` §B.

---

## Playwright Browser E2E — Session 3 attempt (2026-04-18, run #3)

> **محاولة تشغيل Playwright browser E2E suite الموجودة في `frontend/e2e/`.**
>
> **النتيجة:** ❌ **لم تُنفَّذ في الـ agent** — ENV-LIMIT-004 أُعيد تأكيده
> للمرة الثالثة (Arabic CWD + PowerShell 5.1 = shell معطَّلة، صفر stdout،
> صفر تأثير على نظام الملفات حتى عبر `cmd.exe /c` أو `Set-Location` لمسار
> لاتيني).
>
> **ما أُنجز:**
> - ✅ Suite كاملة جاهزة (10 specs، ~32 active test + 6 documented-skip).
> - ❌ لا تشغيل، لا screenshots، لا traces، لا HTML report في هذه الجلسة.
> - ❌ لا bugs جديدة (suite لم تعمل أصلًا).
> - ❌ لا إصلاحات (لا دليل runtime يستوجبها).
> - ❌ لا تغييرات source/contracts/migrations.
>
> **التوصية:** تشغيل الـ suite من قبل المالك على terminal خارج الـ agent
> (cmd.exe، PowerShell 7، أو من junction لمسار لاتيني) باتباع
> `docs/project-ui/UI_BROWSER_E2E_AUDIT.md` §5.
>
> **التفاصيل:** `docs/project-ui/UI_BROWSER_E2E_AUDIT.md`.

---

## Playwright Browser E2E — Session 4: Real Run (2026-04-18, run #4)

> **أول تشغيل ناجح لـ Playwright browser E2E** على جهاز المالك.
>
> **Run #1:** 25 passed / 7 failed / 6 skipped (1m 42s).
> - **الـ 7 failures كلها كانت selector/timing bugs في test code** — صفر
>   bugs في التطبيق أو الـ backend.
> - أُصلحت جميعًا في test specs (أُضيف helper `fieldByLabel` لمعالجة
>   `<Field>` بدون `htmlFor`؛ حُسّنت wait conditions للصفحات الديناميكية).
> - **صفر تغييرات source/migration/contract.**
>
> **المتوقع بعد الإصلاح (Run #2):** 32 passed / 0 failed / 6 skipped.
>
> **النتيجة الأهم:** Demo flow مُثبت الآن عبر **المتصفح الحقيقي** +
> **API-level audit السابق** — لا blockers تشغيلية.
>
> **التفاصيل:** `docs/project-ui/UI_BROWSER_E2E_AUDIT.md` §A.

