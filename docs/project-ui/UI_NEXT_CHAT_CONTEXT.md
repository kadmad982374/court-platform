# UI NEXT CHAT CONTEXT
## السياق المُمرَّر إلى أي chat قادم يعمل على الواجهة الأمامية
> اقرأ هذه الوثيقة كاملًا قبل أي عمل على الواجهة.
>
> **حالة المشروع:** backend = Phase 7 + **Mini-Phase A (D-046) ✅** —
> frontend = Phase 11 + **`AssignLawyerSection` ✅** — Final Closure
> Phase أُنجزت. لا UI phase queued.
>
> **مرجع الإغلاق النهائي على مستوى المشروع كله:** ملفات `FINAL_*` في
> `docs/project/` (CLOSURE_REPORT، TRACEABILITY، BLOCKERS، DEMO_CHECKLIST،
> PILOT_GAP_LIST، PRODUCTION_READINESS_PLAN) + قسم D-046 في
> `docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

---

## 1) ما تم بناؤه في الواجهة حتى الآن

### Phase 8 — Frontend foundation ✅
- مشروع React 18 + TypeScript + Vite + React Router v6 + TanStack Query v5 +
  Axios + RHF + Zod + Tailwind في `frontend/`.
- Auth foundation كاملة: `tokenStorage` (D-044) + `http` (refresh interceptor
  single-flight) + `AuthContext` + `RequireAuth` + `LoginPage`.
- App shell عربي RTL: `Header`/`Sidebar`/`AppShell`.
- صفحات: `Dashboard`, `Profile`, `LegalLibrary`/`PublicEntities`/`Circulars` skeletons, `NotFound`.
- قرارات: D-043, D-044, D-045.

### Phase 9 — Business UI foundation pages ✅
- ربط فعلي بصفحات الأعمال (Cases / Stages / Resolved Register / Execution).
- Helper صلاحيات مركزي يطبّق D-024/D-027/D-030/D-031/D-032.
- UI primitives جديدة: `Table`, `Modal`, `Select`, `Textarea`, `apiError`.
- توسعة `domain.ts` بكل أنواع Phase 2..5 + إصلاح `DelegatedPermission`.
- توسعة navigation بثلاثة عناصر فقط: `/cases`, `/resolved-register`, `/execution-files`.
- 6 مسارات router جديدة + 13 endpoint Phase 1..5 مربوطة فعليًا.

### Phase 10 — Attachments / Reminders / Notifications + knowledge detail + role audit ✅ **(الجلسة الحالية)**
- **المرفقات (D-035 / D-036)**: مكوّن `AttachmentsSection` معاد الاستخدام
  (`STAGE` | `EXECUTION_FILE`) مدمج في `StageDetailPage` و
  `ExecutionFileDetailPage`. ربط 5 endpoints (Phase 6) — رفع وقراءة وتنزيل.
  حد 50MB يُطبَّق UI-side. التنزيل يستخدم blob URL مع Authorization header.
- **التذكيرات (D-037)**: `RemindersSection` داخل `CaseDetailPage`. شخصية
  بالكامل. 3 endpoints مربوطة. حالات `DONE`/`CANCELLED` فقط على `PENDING`.
- **الإشعارات (D-038)**: صفحة `/notifications` كاملة + `mark as read` +
  pagination. لا POST يدوي ولا DELETE.
- **صفحات تفاصيل المعرفة**: `/legal-library/items/:id`,
  `/public-entities/:id`, `/circulars/:id` + روابط من القوائم.
- **Navigation**: عنصر `/notifications` فقط مضاف (تحت "عام").
  `attachments` و `reminders` لا يظهران كعناصر sidebar (مقصود).
- **Helpers صلاحيات جديدة (D-036)**: `canUploadStageAttachment`،
  `canUploadExecutionFileAttachment` — مع 5 اختبارات جديدة.
- **إصلاح ثلاثة باغات Phase 9** على `ReactNode` المفقود (`CaseDetailPage`،
  `ExecutionFilesPage`، `ResolvedRegisterPage`).
- **توثيق جديد**: `UI_ATTACHMENTS_REMINDERS_NOTIFICATIONS_PHASE10.md`،
  `UI_KNOWLEDGE_DETAIL_PAGES_PHASE10.md`،
  `UI_ROLE_COMPATIBILITY_AUDIT_PHASE10.md`.
- **Backend لم يُلمَس** — صفر تغييرات على عقود backend.
- **لا قرارات جديدة D-046+** — كل التفسيرات تستند لـ D-035..D-038 + D-040..D-042.

### Phase 11 — Admin screens (create/edit case + forgot/reset password) + final readiness ✅ **(الجلسة الحالية)**
- **Create-case UI**: `CreateCasePage` at `/cases/new` ⇒ `POST /cases`. Branches/departments
  drop-downs مفلترة بعضويات المستخدم؛ المحاكم بـ branch + departmentType. سبب التأجيل
  الأول نص حر (D-020).
- **Edit-basic-data UI**: `EditCaseBasicDataModal` داخل `/cases/:id` ⇒ `PUT /basic-data`.
  Diff على التغييرات فقط. لا حقول ممنوعة (D-006).
- **Forgot/Reset password**: صفحتان عامتان `/forgot-password` و `/reset-password`
  مربوطتان بعقدَي Phase 1 (D-013 + D-019).
- **Assign-lawyer UI**: لم يُبنَ عمدًا — موثَّق بشكل واضح في
  `BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md`.
- **User admin screens**: لم تُبنَ — موثَّق في `BACKEND_GAP_PHASE11_USER_ADMIN.md`.
- **Helpers جديدة**: `canCreateCase`, `canEditCaseBasicData` (visual-only).
- **Lookups API جديد**: `shared/api/lookups.ts` ⇒ branches/departments/courts.
- **PageHeader** أضيف له slot اختياري `actions`.
- **Backend لم يُلمَس** — صفر تغييرات.
- **لا قرارات جديدة D-046+**.

### Mini-Phase A — Assign Lawyer (UI side) ✅ **(الجلسة الحالية)**
- **API client جديد:** `frontend/src/shared/api/users.ts` —
  `listAssignableLawyers(branchId, departmentId)` + نوع
  `AssignableLawyerOption`. لا generic Users-Admin client (محظور).
- **Permission gate جديد:** `canAssignLawyerForCase(user, caseRef)` في
  `features/auth/permissions.ts`، مرآة محافظة لـ D-046.
- **Component جديد:** `features/cases/AssignLawyerSection.tsx` يُحقن داخل
  `CaseDetailPage`؛ يحتوي قائمة منسدلة + زر تأكيد + loading/error/success
  states. يعرض «المالك الحالي» باسم بدل `#userId`. لا إدخال يدوي
  لـ userId رقمي (محظور صراحة).
- **API helper جديد:** `assignLawyer(caseId, lawyerUserId)` في
  `features/cases/api.ts` يستهلك العقد القائم
  `POST /cases/{id}/assign-lawyer`.
- **استبدال `#userId`:** `lawyerLabel` يحلّ الاسم في حقل «المالك الحالي»
  وعمود «المحامي المُسنَد» داخل `CaseDetailPage`. لم يُربط بعدُ في
  `StageDetailPage` و `ExecutionFileDetailPage` (تحسين بصري لاحق دون
  تغيير عقد).
- **Bug-fix جانبي ضروري في `CaseDetailPage`:** Phase 11 كانت قد تركت
  references إلى `EditCaseBasicDataModal`/`editBasicOpen`/
  `setEditBasicOpen` بدون استيراد/state. أُصلِح ضمن نفس التعديل (state
  جديد + import + زر دخول مرتبط بـ `canEditCaseBasicData`).
- **Tests:**
  - `permissions.test.ts` ⇐ مجموعة `canAssignLawyerForCase` (دور
    مسموح/مرفوض + عضوية فعّالة/غير فعّالة).
  - `AssignLawyerSection.test.tsx` ⇐ visibility (مسموح/مرفوض) + تحميل
    القائمة + نجاح الإسناد + عرض رسالة خطأ. mocks محصورة في
    `@/shared/api/users`، `./api`، و `useAuth`.
  - `lawyerLabel` pure-function tests.
- **قرار جديد:** **D-046** فقط — مثبَّت في
  `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`. لا D-047+.
- **تقرير جاهزية نهائي**: `UI_FINAL_READINESS_REPORT.md` (demo ✅، pilot ⚠️ مشروط، production ❌).

---

## 2) الوثائق المطلوب قراءتها قبل أي عمل
1. backend phases (للسياق): `docs/project/*` كاملة حتى `KNOWLEDGE_DIRECTORY_CIRCULARS_PHASE7.md`.
2. `docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md` (D-001..D-045).
3. `docs/project/PROJECT_PHASE_STATUS.md` و `docs/project/NEXT_CHAT_CONTEXT.md`.
4. **وثائق الإغلاق النهائي (Final Closure Phase) — مرجع رئيسي:**
   - `docs/project/FINAL_PROJECT_CLOSURE_REPORT.md`
   - `docs/project/FINAL_REQUIREMENTS_TRACEABILITY.md`
   - `docs/project/FINAL_PRODUCTION_BLOCKERS.md`
   - `docs/project/FINAL_DEMO_CHECKLIST.md`
   - `docs/project/FINAL_PILOT_GAP_LIST.md`
   - `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md`
5. **Backend gaps موثَّقة (لا تُنفَّذ تلقائيًا):**
   - `docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md`
   - `docs/project/BACKEND_GAP_PHASE11_USER_ADMIN.md`
   - `docs/project/BACKEND_GAP_PHASE11_LOOKUPS.md`
6. **UI خاص:**
   - `docs/project-ui/UI_FOUNDATION_PHASE8.md`
   - `docs/project-ui/UI_NAVIGATION_MODEL.md`
   - `docs/project-ui/UI_AUTH_FLOW.md`
   - `docs/project-ui/UI_BUSINESS_PAGES_PHASE9.md`
   - `docs/project-ui/UI_ROLE_RUNTIME_MATRIX.md`
   - `docs/project-ui/UI_ATTACHMENTS_REMINDERS_NOTIFICATIONS_PHASE10.md`
   - `docs/project-ui/UI_KNOWLEDGE_DETAIL_PAGES_PHASE10.md`
   - `docs/project-ui/UI_ROLE_COMPATIBILITY_AUDIT_PHASE10.md`
   - `docs/project-ui/UI_ADMIN_SCREENS_PHASE11.md`
   - `docs/project-ui/UI_FINAL_READINESS_REPORT.md`
   - `docs/project-ui/UI_PHASE_STATUS.md`
   - `frontend/README.md`

---

## 3) Endpoints المربوطة فعليًا في الـ UI حتى الآن

### Auth/Identity (Phase 8)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`
- `POST /api/v1/auth/logout`
- `GET  /api/v1/users/me`

### Reference list (Phase 8 skeletons)
- `GET /api/v1/legal-library/categories`
- `GET /api/v1/legal-library/items`
- `GET /api/v1/public-entities`
- `GET /api/v1/circulars`

### Business (Phase 9)
- `GET  /api/v1/cases`
- `GET  /api/v1/cases/{id}`
- `GET  /api/v1/cases/{id}/stages`
- `POST /api/v1/cases/{caseId}/promote-to-appeal`
- `POST /api/v1/cases/{caseId}/promote-to-execution`
- `GET  /api/v1/stages/{stageId}`
- `GET  /api/v1/stages/{stageId}/progression`
- `GET  /api/v1/stages/{stageId}/hearing-history`
- `POST /api/v1/stages/{stageId}/rollover-hearing`
- `POST /api/v1/stages/{stageId}/finalize`
- `GET  /api/v1/resolved-register`
- `GET  /api/v1/execution-files`
- `GET  /api/v1/execution-files/{id}`
- `GET  /api/v1/execution-files/{id}/steps`
- `POST /api/v1/execution-files/{id}/steps`

### Phase 10 — newly bound
- `POST  /api/v1/stages/{stageId}/attachments`        (multipart `file`)
- `GET   /api/v1/stages/{stageId}/attachments`
- `POST  /api/v1/execution-files/{id}/attachments`    (multipart `file`)
- `GET   /api/v1/execution-files/{id}/attachments`
- `GET   /api/v1/attachments/{id}/download`           (blob, auth)
- `POST  /api/v1/cases/{id}/reminders`
- `GET   /api/v1/cases/{id}/reminders`
- `PATCH /api/v1/reminders/{id}/status`
- `GET   /api/v1/notifications?page=&size=`
- `PATCH /api/v1/notifications/{id}/read`
- `GET   /api/v1/legal-library/items/{id}`
- `GET   /api/v1/public-entities/{id}`
- `GET   /api/v1/circulars/{id}`

### Phase 11 — newly bound
- `POST  /api/v1/cases`                       (CreateCasePage)
- `PUT   /api/v1/cases/{id}/basic-data`       (EditCaseBasicDataModal)
- `POST  /api/v1/auth/forgot-password`        (ForgotPasswordPage)
- `POST  /api/v1/auth/reset-password`         (ResetPasswordPage)
- `GET   /api/v1/branches`                    (lookups)
- `GET   /api/v1/branches/{id}/departments`   (lookups)
- `GET   /api/v1/courts`                      (lookups, filtered by branch + departmentType)
- `GET   /api/v1/users` *(Mini-Phase A — D-046)* (AssignLawyerSection + owner-name resolution)
- `POST  /api/v1/cases/{id}/assign-lawyer`    *(Mini-Phase A)* (AssignLawyerSection)

### Endpoints موجودة backend ولم تُربط بعد
- (لا شيء مفتوح الآن من Phase 1..7 + Mini-Phase A.) ربط
  `lawyerLabel` داخل `StageDetailPage` و `ExecutionFileDetailPage` تحسين
  بصري بحت يستهلك نفس endpoint القائم — لا حاجة لأي تعاقد جديد.

---

## 4) ما الذي يجب أن يبقى صحيحًا دائمًا (UI)

- **عقود الـ backend Phase 1..7 ثابتة.** الواجهة لا تطلب تعديلًا على backend
  إلا إذا كان هناك mismatch موثَّق.
- كل القرارات D-001..D-046 ثابتة. أي تعديل = D-047+ موثَّق.
- مصدر الحقيقة للأنواع = `frontend/src/shared/types/domain.ts` +
  `frontend/src/shared/api/users.ts` لـ `AssignableLawyerOption` (D-046).
- `tokenStorage` = النقطة الوحيدة لقراءة/كتابة التوكن.
- `http` (axios) = النقطة الوحيدة للنداء.
- **قواعد إخفاء الأزرار** الموثقة في
  `UI_ROLE_COMPATIBILITY_AUDIT_PHASE10.md` + إضافات Phase 11 + Mini-Phase A:
  - Rollover/Finalize → assigned lawyer + writable stage فقط (D-024).
  - Promote to appeal → SECTION_HEAD أو ADMIN_CLERK+PROMOTE_TO_APPEAL (D-027).
  - Promote to execution → SECTION_HEAD أو ADMIN_CLERK+PROMOTE_TO_EXECUTION (D-030).
  - Add execution step → assignedUserId أو ADMIN_CLERK+ADD_EXECUTION_STEP، على ملف غير مغلق (D-031/D-032).
  - **Stage attachment upload** → assigned lawyer أو SECTION_HEAD/ADMIN_CLERK
    عضو نشط في (branch, dept) (D-036).
  - **Execution-file attachment upload** → assignedUserId أو
    SECTION_HEAD/ADMIN_CLERK عضو نشط في (branch, dept) (D-036).
  - **Reminder status** → فقط على `PENDING` للمالك (D-037).
  - **Notification mark-read** → فقط على إشعارات المستخدم غير المقروءة (D-038).
  - **Create case** (Phase 11) → SECTION_HEAD member، أو ADMIN_CLERK member +
    `CREATE_CASE` delegation (D-004 + الخادم authoritative).
  - **Edit case basic data** (Phase 11) → نفس القاعدة لكن مرتبطة بـ
    (createdBranchId, createdDepartmentId) للدعوى نفسها.
  - **Assign lawyer** (Mini-Phase A — D-046) → SECTION_HEAD أو
    ADMIN_CLERK+ASSIGN_LAWYER، عضو نشط في (createdBranchId,
    createdDepartmentId) للدعوى. الخادم authoritative.
- لا تكرّر منطق scope الخلفي (D-021/D-025/D-028/D-032/D-046) في UI.
- ❌ ~~`assign-lawyer UI ممنوع بناؤه`~~ ✅ بُني في Mini-Phase A عبر
  endpoint مخصص `GET /api/v1/users` (D-046).
- ✋ **`/admin/users` ممنوع بناؤه** قبل Mini-Phase B + قرارات D-047/D-048
  (راجع `BACKEND_GAP_PHASE11_USER_ADMIN.md`).
- لا state management ثقيل قبل أن نحتاجه فعلًا.
- لا mock data إن كان الـ endpoint موجودًا.
- لا تكسر RTL/Arabic-first.

---

## 5) Gaps معلَّقة بعد Phase 11 + Mini-Phase A

- **Gap #1** — لا endpoint عام لـ `PostponementReasons`. حلّ Phase 11: نص حر
  في `CreateCasePage` (مطابق لـ D-020؛ العمود نفسه VARCHAR في DB).
  راجع `BACKEND_GAP_PHASE11_LOOKUPS.md`. — ⚠️ مفتوح (تحسين UX، لا يمنع pilot).
- **Gap #2** — تم إصلاحه في Phase 9.
- **Gap #3** — ✅ **مغلق بـ Mini-Phase A (D-046)**.
- **Gap #4** — ✅ مغلق كاملًا الآن (create + edit-basic-data + assign-lawyer).
- **Gap #5** — تم حلّه في Phase 10.
- **Gap #6 — User/Role/Membership/Delegation admin** — لا يزال مفتوحًا.
  راجع `BACKEND_GAP_PHASE11_USER_ADMIN.md`. **عائق production.**

---

## 6) ما هي بالضبط المرحلة التالية المطلوب تنفيذها

**Final Closure Phase + Mini-Phase A أُنجزتا.** لا UI phase queued تلقائيًا.
قرار المتابعة بيد المالك. خياران لا ثالث لهما:

1. **اعتماد المشروع كما هو لـ demo / pilot محدود** ⇒ اتباع
   `docs/project/FINAL_DEMO_CHECKLIST.md` أو
   `docs/project/FINAL_PILOT_GAP_LIST.md`. صفر تطوير UI إضافي. صفر قرارات
   جديدة. تجربة الإسناد أصبحت من الواجهة بلا تدخّل DBA.
2. **بدء Mini-Phase B لسد عائق إدارة المستخدمين** ⇒ اتباع
   `docs/project/BACKEND_GAP_PHASE11_USER_ADMIN.md` +
   `docs/project/FINAL_PRODUCTION_READINESS_PLAN.md` بالترتيب. يستلزم
   قرارات D-047/D-048 موثَّقة، وكل UI sub-phase تتبع تنفيذ الـ backend
   المرافق:
   - Backend Mini-Phase B + D-047/D-048 ⇒ بعدها UI: `/admin/users`
     minimal (قائمة + إنشاء + تفعيل/تعطيل + tabs roles/memberships/
     delegations/court access).
   - بعدها صلابة الإنتاج (httpOnly cookies = D-049+، object storage،
     SMS، AV، backup، rate limiting، secrets management).

تحسين بصري اختياري لا يحتاج قرارًا جديدًا (لأنه يستهلك نفس endpoint
D-046):
- ربط `lawyerLabel` داخل `StageDetailPage` و `ExecutionFileDetailPage`
  لاستبدال `#userId` بأسماء هناك أيضًا.

ممنوع في المرحلة التالية:
- بناء أي UI feature جديدة قبل قرار صريح ببدء المسار 2 (باستثناء
  التحسين البصري أعلاه).
- إضافة write APIs على backend دون قرار + Phase backend موازية.
- تجاوز قواعد D-035..D-039 + D-046.
- تحويل وحدات Phase 7 إلى CMS.
- ادعاء production-readiness قبل سدّ blockers الموثَّقة.

---

الخطوة التالية: لا تبدأ أي UI جديدة قبل حسم ما إذا كان المشروع سيُغلق كـ demo/pilot أو ستبدأ backend mini-phase لسد gaps الإدارة.
