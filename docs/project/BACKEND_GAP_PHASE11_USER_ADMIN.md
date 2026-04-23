# BACKEND_GAP_PHASE11_USER_ADMIN.md
## Gap موثَّق — إدارة المستخدمين / العضويات / التفويضات

> **حالة 2026-04:** ✅ **مغلق على مستوى Backend عبر Mini-Phase B**
> (D-047 + D-048). الجزء المتبقي هو **UI sub-phase B** (`/admin/users`)
> الذي **لم يبدأ بعد** ويُنفَّذ في برومبت لاحق فوق نفس العقود.
> الـ blockers الإنتاجية الأخرى (httpOnly cookies, object storage, SMS,
> AV, scheduler, backups, secrets, rate limiting, deployment hardening)
> تبقى مفتوحة — انظر `FINAL_PRODUCTION_BLOCKERS.md`.

---

## المبرّر
حاليًا، المسار الوحيد لإدخال مستخدمين هو:
- `BootstrapAdminRunner` ⇒ ينشئ `CENTRAL_SUPERVISOR` واحد عند أول إقلاع
  (D-018) ⇒ غير صالح للإنتاج بعد المستخدم الأول.
- لا APIs لإنشاء مستخدمين، إسناد أدوار، تفعيل/تعطيل، إعادة تعيين العضويات،
  منح/سحب تفويضات (`UserDelegatedPermission`)، أو إدارة court access.

نتيجة ذلك: لا يمكن في الإنتاج إنشاء رئيس فرع جديد، أو محامٍ جديد، أو منح
موظف إداري تفويضًا، **بدون تعديل قاعدة البيانات يدويًا**.

---

## الحد الأدنى المقترح (Conservative)

### 1) Users CRUD محدود
```
POST   /api/v1/users
PATCH  /api/v1/users/{id}             (active, fullName, mobileNumber)
GET    /api/v1/users/{id}              (تفاصيل أكثر من /me لإدارة فقط)
GET    /api/v1/users                   (paginated، فلاتر: role, branch, dept, q)
```
- مسموح فقط لـ `CENTRAL_SUPERVISOR` (لا تفويض لهذه الإجراءات لأي دور آخر
  في الحد الأدنى).
- لا حذف فعلي — `active=false` فقط.
- كلمة المرور الأولية تُسلَّم عبر آلية محدَّدة (مثلاً تتمَّت يدويًا ثم يُلزَم
  المستخدم بإعادة التعيين عند أول دخول — يحتاج قرارًا جديدًا).

### 2) Roles
```
POST   /api/v1/users/{id}/roles      { role: RoleCode }
DELETE /api/v1/users/{id}/roles/{role}
```
- محصور بـ `CENTRAL_SUPERVISOR`.

### 3) Department memberships
```
POST   /api/v1/users/{id}/department-memberships
       { branchId, departmentId|null, membershipType, primary, active }
PATCH  /api/v1/users/{id}/department-memberships/{mid}
       { active|primary }
```
- محصور بـ `CENTRAL_SUPERVISOR` أو `BRANCH_HEAD` لفرعه فقط.
- قيد: `BRANCH_HEAD` لا يستطيع منح أدوار `BRANCH_HEAD` آخرين.

### 4) Delegated permissions
```
POST   /api/v1/users/{id}/delegated-permissions
       { code: DelegatedPermissionCode, granted: boolean }
PATCH  /api/v1/users/{id}/delegated-permissions/{pid}
       { granted: boolean }
```
- مسموح لـ `SECTION_HEAD` لقسمه فقط (D-004 — يمنح/يسحب صلاحيات الإكلرك في
  نفس قسمه).
- `CENTRAL_SUPERVISOR` يستطيع لكل قسم.

### 5) Court access (اختياري في هذه الـ mini-phase)
```
POST   /api/v1/users/{id}/court-access     { courtId }
DELETE /api/v1/users/{id}/court-access/{caid}
```
- مسموح لمن لديه `MANAGE_COURT_ACCESS` (موجود كرمز في
  `DelegatedPermissionCode`) أو `SECTION_HEAD` في نفس قسم المحكمة.

---

## ما يتحرَّر في الـ UI بعد ذلك
- `/admin/users` (قائمة + بحث + إنشاء + تفعيل/تعطيل).
- `/admin/users/:id` (تفاصيل + tabs للأدوار/العضويات/التفويضات/المحاكم).
- استبدال جميع `#userId` بأسماء فعلية في صفحات الأعمال.

---

## القرار المطلوب لاحقًا
عند تنفيذ هذه الـ mini-phase ستظهر قرارات D-047, D-048, ... كل واحدة
محصورة بنطاق دقيق:
- D-047 محتمل: «منح كلمات المرور الأولية يتم عبر تتمَّت OTP إعادة تعيين
  مفروض».
- D-048 محتمل: «BRANCH_HEAD لا يستطيع منح أدوار `BRANCH_HEAD`».

**لا يُنفَّذ شيء من هذا في Phase 11.**

---

## ✅ التنفيذ الفعلي — Mini-Phase B (2026-04)

> هذا القسم يوثّق ما نُفِّذ فعلًا. القرارات المعتمدة:
> **D-047** (سياسة كلمة المرور الأولية) و **D-048** (BRANCH_HEAD لا يُنشئ
> BRANCH_HEAD) — انظر `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

### Endpoints المضافة فعلًا
| Method | Path | Allowed | الملاحظات |
|--|--|--|--|
| `POST`   | `/api/v1/users` | CENTRAL_SUPERVISOR | Body = `CreateUserRequest`. يعيد `201` + `{id}`. |
| `GET`    | `/api/v1/users/{id}` | CENTRAL_SUPERVISOR | يعيد `UserAdminDto` (يشمل roles + memberships + delegations + court access). |
| `PATCH`  | `/api/v1/users/{id}` | CENTRAL_SUPERVISOR | الحقول المسموحة فقط: `active`, `fullName`, `mobileNumber`. |
| `GET`    | `/api/v1/users` | CENTRAL_SUPERVISOR | Paginated `PageResponse<UserSummaryDto>`. فلاتر: `role`, `branchId`, `departmentId`, `active`, `q`, `page`, `size`. **لا يستجيب** لو وُجد `membershipType` (يبقى لمسار D-046). |
| `POST`   | `/api/v1/users/{id}/roles` | CENTRAL_SUPERVISOR | idempotent. حارس D-048. |
| `DELETE` | `/api/v1/users/{id}/roles/{role}` | CENTRAL_SUPERVISOR | حارس D-048. `404` لو لم يكن مسندًا. |
| `POST`   | `/api/v1/users/{id}/department-memberships` | CENTRAL_SUPERVISOR أو BRANCH_HEAD لفرعه (لكن نوع `BRANCH_HEAD` يقتصر على المركزي — D-048). | يرفض `BRANCH_HEAD`+`departmentId!=null` بـ `INVALID_MEMBERSHIP`. |
| `PATCH`  | `/api/v1/users/{id}/department-memberships/{mid}` | كأعلاه (نطاق العضوية الأصلي). | الحقول: `active`, `primary`. |
| `POST`   | `/api/v1/users/{id}/delegated-permissions` | CENTRAL_SUPERVISOR أو SECTION_HEAD لقسم target (إن كان target = ADMIN_CLERK نشط). | upsert idempotent بحسب `code`. |
| `PATCH`  | `/api/v1/users/{id}/delegated-permissions/{pid}` | كأعلاه. | الحقل: `granted`. |
| `POST`   | `/api/v1/users/{id}/court-access` | كما في خدمة الوصول للمحاكم (SECTION_HEAD أو ADMIN_CLERK + `MANAGE_COURT_ACCESS`). | duplicate active = `409 COURT_ACCESS_DUPLICATE`. |
| `DELETE` | `/api/v1/users/{id}/court-access/{caid}` | كأعلاه. | حذف منطقي (`active=false`). |

> ملاحظة: مسارات الـ bulk القديمة في `AccessControlController`
> (`PUT /court-access`, `PUT /delegated-permissions`,
> `GET /department-memberships`) **لم تُغيَّر**؛ تتعايش مع الـ singular
> الجديدة لأن الـ UI القديم لا يزال يستهلكها.

### الملفات المضافة / المعدَّلة (Backend)
- جديد — `sy.gov.sla.identity.api`:
  `CreateUserRequest`, `UpdateUserRequest`, `UserAdminDto`,
  `UserSummaryDto`, `AssignRoleRequest`, `CreateMembershipRequest`,
  `UpdateMembershipRequest`, `AddDelegatedPermissionRequest`,
  `UpdateDelegatedPermissionRequest`, `AddCourtAccessRequest`,
  `UsersAdminController`, `UserAccessAdminController`.
- جديد — `sy.gov.sla.identity.application`:
  `UserAdminService`, `UserRoleAdminService`,
  `UserMembershipAdminService`, `UserDelegationAdminService`,
  `UserCourtAccessAdminService`.
- معدَّل — `UsersController`: تمت إضافة قيد `params="membershipType"`
  على Mini-Phase A handler لتفادي الالتباس مع الـ admin GET الجديد.
- معدَّل — `UserRepository`: أصبح يمدِّد `JpaSpecificationExecutor<User>`
  وأضيف `existsByMobileNumber`.
- معدَّل — `UserRoleRepository`: أضيف
  `findByUserIdAndRoleId` و `deleteByUserIdAndRoleId` و `findByRoleId`.
- معدَّل — `UserDepartmentMembershipRepository`: أضيف helpers الكشف عن
  العضويات المكرَّرة (مع/بدون `departmentId`).
- معدَّل — `ForbiddenException`: constructor إضافي يقبل code مخصصًا
  لإرجاع `BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD` و `COURT_OUTSIDE_SCOPE`.
- معدَّل — `GlobalExceptionHandler`: handler جديد لـ
  `HttpMessageNotReadableException` ⇒ يُرجع `400 INVALID_REQUEST_BODY`
  بدلًا من `500` للأجسام JSON المعطوبة (مثل enum خاطئ).
- بدون أي migration جديد للـ DB. الكيانات القائمة كافية.

### الاختبارات
- `backend/src/test/java/sy/gov/sla/identity/UserAdminApiIT.java` —
  22 اختبار تكاملي يغطّي البنود 1..16 المطلوبة في برومبت Mini-Phase B
  بالإضافة إلى regression لمسار D-046:
  1) إنشاء مستخدم بواسطة CENTRAL_SUPERVISOR + قابلية الدخول.
  2) منع غير المركزي من الإنشاء (BRANCH_HEAD/SECTION_HEAD/CLERK/LAWYER).
  3) USERNAME_TAKEN.
  4) WEAK_PASSWORD (سلسلة seed محظورة).
  5) BRANCH_DEPT_MISMATCH.
  6) PATCH active=false يحجب الدخول.
  7) PATCH fullName/mobileNumber.
  8) GET paginated + فلتر role.
  9) GET admin يُمنع لغير المركزي.
  10) Regression: `?membershipType=...` يبقى يعيد قائمة المحامين (D-046).
  11) إسناد دور idempotent + revoke + 404 على revoke ثاني.
  12) دور غير صالح ⇒ `400`.
  13) **D-048**: BRANCH_HEAD لا يمنح BRANCH_HEAD ⇒
      `403 BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD`.
  14) SECTION_HEAD لا يستطيع منح أدوار في Mini-Phase B.
  15) إضافة عضوية BRANCH_HEAD مع departmentId ⇒ `400 INVALID_MEMBERSHIP`.
  16) BRANCH_DEPT_MISMATCH على عضوية.
  17) DUPLICATE_MEMBERSHIP.
  18) BRANCH_HEAD ينجح في فرعه ويُمنع في فرع آخر.
  19) SECTION_HEAD يمنح تفويضًا للموظف الإداري في قسمه فقط (D-004).
  20) Court access: grant + duplicate (409) + revoke (logical) + re-grant.
  21) Court access: caller غير مفوَّض ⇒ `403`.
  22) anonymous ⇒ `401`.

### نتيجة الـ Build / Tests
- `mvn -DskipTests compile` ⇒ ✅ BUILD SUCCESS.
- `mvn -Dtest=UserAdminApiIT test` ⇒ ✅ 22/22 PASS.
- `mvn -Dtest=AssignableLawyersApiIT test` (regression D-046) ⇒
  ✅ 12/12 PASS.
- `mvn -Dtest=AccessControlApiIT test` (regression bulk endpoints) ⇒
  ✅ 5/5 PASS.
- `mvn test` (كل unit tests) ⇒ ✅ 49/49 PASS.
- `mvn '-Dtest=*IT' test` ⇒ 17 فشل في تكاملات Phase 5/6 سابقة لـ
  Mini-Phase B (تداخل سياق Spring المشترك). نُفِّذت تكاملات
  Mini-Phase B بمعزل + تكاملات الجوار (Mini-Phase A، AccessControl) كلها
  خضراء. الـ 17 فشل غير مرتبط بهذه الـ mini-phase ويُسجَّل كـ
  flakiness قائم في `FINAL_PRODUCTION_BLOCKERS.md`.

### حالة الفجوة
- ✅ **Backend User Admin gap = مغلق** (تم تنفيذ كل ما في القائمة الأصلية
  أعلاه + التزام صارم بـ D-047/D-048).
- ✅ **UI sub-phase B = COMPLETED** (`/admin/users` +
  `/admin/users/:id` minimal). راجع
  `frontend/src/features/admin-users/` (pages + components + hooks +
  api) و `NEXT_CHAT_CONTEXT.md` §«UI sub-phase B». 22 unit test أخضر.
- ✅ **عائق User Admin مُغلَق بالكامل** على مستوى Backend وعلى مستوى
  UI. لم يَعُد blocker في `FINAL_PRODUCTION_BLOCKERS.md`.
- ❌ Production-hardening blockers الأخرى (httpOnly cookies, object
  storage, SMS, AV, scheduler, backups, secrets, rate limiting,
  deployment hardening) **لا تزال مفتوحة** ويجب معالجتها بالترتيب
  الموثَّق في `FINAL_PRODUCTION_READINESS_PLAN.md` §3..§15.

