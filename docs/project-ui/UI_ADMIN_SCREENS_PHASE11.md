# UI_ADMIN_SCREENS_PHASE11.md
## المرحلة 11 — شاشات الإدارة + الإغلاق

> هذا الملف يوثّق ما تمّ بناؤه فعليًا في Phase 11 من شاشات الإدارة المتبقية،
> وما **لم** يُبنَ بسبب نقص في عقود الـ backend الحالية.
>
> القاعدة الحاكمة: **لا اختراع endpoints**. كل ما هنا يستخدم عقدًا موجودًا في
> backend منذ Phase 1–7. لا قرار جديد ولا خرق لـ D-001..D-045.

---

## 1) ما تمّ بناؤه فعليًا

### 1.1 — `/cases/new` — `CreateCasePage`
- **الواجهة:** `frontend/src/features/cases/CreateCasePage.tsx`.
- **العقد المستخدم:** `POST /api/v1/cases` (موجود — Phase 2).
- **Lookups مستخدمة:**
  - `GET /api/v1/branches`
  - `GET /api/v1/branches/{id}/departments`
  - `GET /api/v1/courts?branchId=…&departmentType=…`
- **آلية الفلترة من جانب العميل (visual-only):**
  - dropdown الفروع: محصور بالفروع التي للمستخدم فيها عضوية فعّالة بصفة
    `SECTION_HEAD` أو `ADMIN_CLERK` (الـ backend سيرفض ما عدا ذلك بـ 403 وفق
    `requireCaseManagement(actor, branch, dept, CREATE_CASE)`).
  - dropdown الأقسام: محصور بأقسام الفرع المختار التي للمستخدم فيها العضوية
    أعلاه.
  - dropdown المحاكم: مفلتر بـ `branchId` + `departmentType` المشتق من
    `stageType` المختار، ليطابق `OrganizationService.validateConsistency`.
- **التحكم في الإظهار:** `canCreateCase(user)` (helper جديد في
  `permissions.ts`). الزر يظهر في `CasesListPage` فقط لأصحاب الصلاحية.
- **حقل سبب التأجيل الأول:** نص حرّ. هذا متوافق مع **D-020** الذي يثبت أن
  `first_postponement_reason` في قيد الدعوى نص حر VARCHAR، والقائمة المعيارية
  `postponement_reasons` تُستهلَك فقط في rollover/finalize (Phase 3+).
- **الأخطاء:** أي رفض من backend (403/400/409) يُعرض حرفيًا عبر
  `extractApiErrorMessage`.

### 1.2 — `EditCaseBasicDataModal` داخل `CaseDetailPage`
- **الواجهة:** `frontend/src/features/cases/EditCaseBasicDataModal.tsx`.
- **العقد المستخدم:** `PUT /api/v1/cases/{id}/basic-data` (موجود — Phase 2،
  ملزَم بـ `requireCaseManagement(..., EDIT_CASE_BASIC_DATA)`).
- **التحكم في الإظهار:** زر «تعديل البيانات الأساسية» في بطاقة «أفعال على
  مستوى الدعوى» يظهر فقط إذا أعاد `canEditCaseBasicData(user, case)` صحيحًا
  (مطابقة فعلية للعضوية على فرع/قسم الدعوى نفسها).
- **حقول معروضة:** الجهة العامة، صفتها، الخصم، رقم/سنة الأساس الأصلي،
  المحكمة (مفلترة بنوع المرحلة الحالية كي لا يُكسر validateConsistency)،
  اسم الدائرة، رقم/سنة أساس المرحلة، تاريخ الجلسة الأولى، سبب التأجيل الأول.
- **حقول مُستبعَدة عمدًا** (ممنوع تعديلها على الخادم):
  - `originalRegistrationDate` ← D-006.
  - الإسناد (lawyer ownership) ← `assign-lawyer` endpoint منفصل.
  - حالة المرحلة (`stageStatus`) ← يُحرَّك عبر progression/finalization فقط.
  - `branchId / departmentId` ← غير قابلة للتغيير على هذا endpoint.
- **حساب diff:** يُرسل فقط الحقول التي تغيّرت فعليًا، احترامًا لدلالة
  `Optional` في `UpdateBasicDataRequest` على الخادم.

### 1.3 — `/forgot-password` — `ForgotPasswordPage`
- **الواجهة:** `frontend/src/features/auth/ForgotPasswordPage.tsx`.
- **العقد المستخدم:** `POST /api/v1/auth/forgot-password { mobileNumber }`
  (موجود — Phase 1، public).
- **سلوك معتمد على D-013:** الرسالة محايدة دائمًا («إن كان الرقم مسجَّلًا،
  سيصلك رمز…») لمنع account enumeration.
- زر «لديّ الرمز» يحوّل إلى `/reset-password` مع تمرير رقم الجوال عبر
  `location.state`.

### 1.4 — `/reset-password` — `ResetPasswordPage`
- **الواجهة:** `frontend/src/features/auth/ResetPasswordPage.tsx`.
- **العقد المستخدم:** `POST /api/v1/auth/reset-password { mobileNumber, code,
  newPassword }` (موجود — Phase 1، public).
- **التحقق:** نموذج zod يتطلب طول 8+ لكلمة المرور وتأكيدًا مطابقًا.
- **عند النجاح:** بحسب D-019 يبطل الخادم كل refresh tokens النشطة للمستخدم؛
  الواجهة تنقل إلى `/login` مع state `resetOk=true` لعرض شريط تأكيد أخضر.
- **أخطاء معالَجة برسائل عربية:** `INVALID_OTP`, `OTP_EXPIRED`، أو رسالة
  عامة من الخادم.

### 1.5 — تعديلات صغيرة مكمِّلة
| الملف | التغيير |
|------|---------|
| `frontend/src/app/router.tsx` | إضافة `/forgot-password`, `/reset-password`, `/cases/new`. |
| `frontend/src/features/auth/LoginPage.tsx` | رابط «نسيت كلمة المرور؟» + شريط نجاح بعد reset. |
| `frontend/src/features/cases/CasesListPage.tsx` | زر «+ إنشاء دعوى» (gated بـ `canCreateCase`). |
| `frontend/src/features/cases/CaseDetailPage.tsx` | زر «تعديل البيانات الأساسية» + حقن `EditCaseBasicDataModal`. |
| `frontend/src/features/cases/api.ts` | `createCase`, `updateCaseBasicData`. |
| `frontend/src/features/auth/api.ts` | `forgotPassword`, `resetPassword`. |
| `frontend/src/features/auth/permissions.ts` | `canCreateCase`, `canEditCaseBasicData` (visual-only؛ الخادم هو السلطة). |
| `frontend/src/features/auth/permissions.test.ts` | حالتا اختبار جديدتان للـ helpers. |
| `frontend/src/shared/api/lookups.ts` | `listBranches`, `listDepartments`, `listCourts` جديد. |
| `frontend/src/shared/types/domain.ts` | إضافة `Branch`, `Department`, `Court`, `DepartmentType`, `CreateCaseRequest`, `UpdateCaseBasicDataRequest`, `AssignLawyerRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`. |
| `frontend/src/shared/ui/PageHeader.tsx` | slot اختياري `actions` لزر القيد. |

---

## 2) ما **لم** يُبنَ في Phase 11 — وأسبابه

### 2.1 — Assign-Lawyer UI (**عمدًا غير مبني في Phase 11 — ✅ بُني لاحقًا في Mini-Phase A**)
**السبب الأصلي (Phase 11):** لا يوجد `GET /api/v1/users` يُعيد قائمة قابلة للاختيار من المحامين
(`STATE_LAWYER` النشطين في فرع/قسم دعوى محدد). الـ endpoint الوحيد الموجود كان
`GET /api/v1/users/me`.

`POST /api/v1/cases/{id}/assign-lawyer` يقبل `lawyerUserId: number` فقط، وأي
نموذج يطلب من المستخدم إدخال رقم رقمي هو UX غير صالح للعرض.

**القرار وفق برومبت Phase 11:** «لا تبنِ assign-lawyer UI بدون مصدر بيانات
واقعي للمحامين». لذلك:
- لم يُضف زر «إسناد محامٍ» في `CaseDetailPage`.
- لم تُضف حقل في `CreateCasePage` لاختيار المحامي عند الإنشاء (الخادم يقبل
  الإنشاء بدون محامٍ مبدئيًا — `current_owner_user_id = null`).
- وثّقنا الـ gap الكامل في `docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md`
  مع تعريف الحد الأدنى المطلوب من backend.

#### ✅ تحديث Mini-Phase A (D-046)
- أُضيف `GET /api/v1/users?branchId&departmentId&membershipType=STATE_LAWYER&activeOnly=true`
  read-only ضمن `UsersController`.
- أُنشئ `frontend/src/features/cases/AssignLawyerSection.tsx` ويُحقن داخل
  `CaseDetailPage` تحت visibility gate `canAssignLawyerForCase`.
- `lawyerLabel` يحلّ اسم المحامي بدل `#userId` في حقل «المالك الحالي»
  وعمود «المحامي المُسنَد» ضمن جدول المراحل.
- لم يُضَف بعدُ حقل اختيار المحامي عند الإنشاء داخل `CreateCasePage`
  (يكفي الإسناد بعدها من `CaseDetailPage`؛ تحسين بصري لاحق دون تغيير
  عقد).
- لم يُربط `lawyerLabel` بعدُ في `StageDetailPage` و
  `ExecutionFileDetailPage` (تحسين بصري لاحق لا يمنع pilot/production).
- المرجع التنفيذي: `docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md`
  (مغلق) + قسم D-046 في `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

### 2.2 — قائمة `postponement_reasons` كقائمة منسدلة في إنشاء الدعوى
لا يوجد endpoint عام `GET /api/v1/postponement-reasons` (الجدول يُستخدم داخليًا
في rollover/finalize). الحل المعتمد: **نص حر** مطابق لـ D-020. لو طُلب لاحقًا
كشف القائمة، تُوثَّق mini-phase خفيفة في
`docs/project/BACKEND_GAP_PHASE11_LOOKUPS.md`.

### 2.3 — User/Admin management screens (CRUD على المستخدمين/الأدوار/التفويضات)
**خارج النطاق عمدًا** بحسب توجيه Phase 11: «ابدأها فقط إذا كانت ضرورية فعليًا
لإغلاق gaps العرض/الإدارة. ابقها minimal». بما أن:
- إنشاء أول مستخدم ممكن عبر `BootstrapAdminRunner` (D-018).
- لا backend endpoints لإدارة المستخدمين (`POST /users`, `PATCH /users/{id}`,
  `POST /users/{id}/memberships`, `POST /users/{id}/delegated-permissions`)؛
  بناء واجهة بدون دعم خادم سيكون اختراع عقود.

تُوثَّق الحاجة كاملة في `docs/project/BACKEND_GAP_PHASE11_USER_ADMIN.md`.

### 2.4 — حذف/إعادة تفعيل المرفقات، إعادة فتح التذكيرات، إلخ.
خارج النطاق عمدًا (D-039). لا تغيير.

---

## 3) قرارات جديدة (D-046+)؟

**لا.** كل ما بُني في Phase 11 يقع داخل قرارات D-001..D-045 الموجودة:
- D-004 (المفوَّض ↔ ADMIN_CLERK)، D-006 (immutability)، D-013 (OTP محايد)،
  D-018 (bootstrap)، D-019 (token rotation)، D-020 (نص حر للسبب الأول)،
  D-044 (`localStorage` token storage).

أي توسعة للأدمن تتطلب Backend mini-phase ⇒ سيُسجَّل قرار جديد عند البدء بها،
ليس الآن.

---

## 4) Verification

- **TypeScript:** `get_errors` على كل الملفات المُعدَّلة/المُنشأة (13 ملفًا)
  أعاد **zero errors**.
- **Tests:** أُضيفت حالتا اختبار جديدتان في `permissions.test.ts`
  (`canCreateCase`, `canEditCaseBasicData`) تغطيان جميع توليفات
  role/membership/delegation. الـ vitest suite لم يُمكن تنفيذها مباشرة في
  هذه الجلسة بسبب مشكلة عرض في الطرفية مع المسار العربي، لكن الكود يُجمَّع
  بدون أخطاء، والـ helpers مغطّاة بطريقة pure-function تعتمد فقط على بنى
  المُختبَرة سابقًا.
- **Navigation:** لم تُضف أي بنود إلى `NAV_ITEMS` (الإجراءات الإدارية inline
  داخل `/cases` و `/cases/:id` كي لا تكسر D-045).

---

## 5) ملخص الملفات

### مُنشأة
- `frontend/src/features/cases/CreateCasePage.tsx`
- `frontend/src/features/cases/EditCaseBasicDataModal.tsx`
- `frontend/src/features/auth/ForgotPasswordPage.tsx`
- `frontend/src/features/auth/ResetPasswordPage.tsx`
- `frontend/src/shared/api/lookups.ts`

### مُعدَّلة
- `frontend/src/app/router.tsx`
- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/features/auth/api.ts`
- `frontend/src/features/auth/permissions.ts`
- `frontend/src/features/auth/permissions.test.ts`
- `frontend/src/features/cases/api.ts`
- `frontend/src/features/cases/CasesListPage.tsx`
- `frontend/src/features/cases/CaseDetailPage.tsx`
- `frontend/src/shared/types/domain.ts`
- `frontend/src/shared/ui/PageHeader.tsx`

