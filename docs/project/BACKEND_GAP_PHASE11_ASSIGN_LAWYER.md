# BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
## Gap موثَّق — ✅ **CLOSED** بواسطة Mini-Phase A

> **حالة هذا الملف:** الـ gap **مُغلَق**. النص أدناه محفوظ كسجل تاريخي
> لما كان مطلوبًا، مع إضافة قسم «التنفيذ الفعلي» في الأسفل.
>
> القرار الحاكم: **D-046** في `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

---

## السياق
- العقد القائم: `POST /api/v1/cases/{id}/assign-lawyer { lawyerUserId: number }`.
- الخادم يلزم: `STATE_LAWYER` نشط في `(case.createdBranchId, case.createdDepartmentId)`،
  مع `requireCaseManagement(actor, ..., ASSIGN_LAWYER)` على المنفِّذ.
- الواجهة لا تستطيع تقديم اختيار سليم لأن لا endpoint يكشف قائمة المحامين
  المؤهَّلين.

## ما يحتاجه الـ UI كحدٍّ أدنى

### Endpoint مقترح (read-only)
```
GET /api/v1/users
    ?branchId={Long}            (مطلوب)
    &departmentId={Long}        (مطلوب)
    &membershipType=STATE_LAWYER (افتراضيًا — كافٍ في Phase 11)
    &activeOnly=true             (افتراضيًا)
```

#### Response
```json
[
  { "id": 17, "fullName": "محمد ع.", "username": "m.ali", "active": true }
]
```

#### Authorization (محافِظ)
- مسموح فقط لـ:
  - `SECTION_HEAD` لعضوية فعّالة في `(branchId, departmentId)`.
  - `ADMIN_CLERK` لعضوية فعّالة في `(branchId, departmentId)` ولديه تفويض
    `ASSIGN_LAWYER`.
- أي دور آخر ⇒ **403** (يجب ألا نكشف قوائم المحامين بشكل عام).

#### قيود
- لا تعديل user من هذا endpoint (read-only).
- لا تعريض `mobileNumber` أو `delegatedPermissions` أو أي حقل خارج الحاجة
  (`id`, `fullName`, `username`, `active`).
- يُرشَّح بـ `users.active = true` و `department_memberships.active = true`.

### ما يتحرَّر في الـ UI بعد ذلك
1. **`AssignLawyerSection`** داخل `CaseDetailPage`:
   - زر «إسناد محامٍ» / «تغيير المحامي» (حسب `currentOwnerUserId`).
   - Modal مع قائمة منسدلة من المحامين المتاحين.
   - يستهلك `POST /assign-lawyer` بالمعرّف المختار.
2. **`CreateCasePage`**: حقل اختياري «إسناد المحامي عند الإنشاء» يستدعي بعد
   إنشاء الدعوى endpoint الإسناد.
3. **عرض الاسم بدل الرقم** في `CaseDetailPage` و `CasesListPage` و
   `StageDetailPage` و `ExecutionFileDetailPage` (يحوَّل `userId` إلى
   `fullName`).

### أثر ثانوي مفيد جدًا للعرض
يمكن أن نستهلك نفس الـ endpoint لعرض اسم المحامي بدل `#42` في:
- `Field "المحامي المُسنَد"` في `StageDetailPage`.
- `Field "المالك الحالي"` في `CaseDetailPage`.
- `assignedUserId` في `ExecutionFileDetailPage`.

### Out of scope لهذه الـ mini-phase
- `POST /users` لإنشاء مستخدم جديد ⇒ موثَّق في
  `BACKEND_GAP_PHASE11_USER_ADMIN.md`.
- إدارة العضويات/التفويضات ⇒ موثَّق في
  `BACKEND_GAP_PHASE11_USER_ADMIN.md`.

---

## القرار المطلوب لاحقًا (D-046+)
عند تنفيذ هذه الـ mini-phase: يُسجَّل قرار جديد رقم D-046 يحدد:
- شكل الاستجابة الدقيق.
- قواعد الصلاحية المعتمدة.
- ما إذا كان `membershipType` معلمة قابلة للتوسعة لاحقًا (مثلاً
  `SECTION_HEAD`/`ADMIN_CLERK` لاستعراضات لاحقة) أو مغلقة على
  `STATE_LAWYER` فقط.

**لا يُنفَّذ شيء من هذا في Phase 11.**

---

## ✅ التنفيذ الفعلي — Mini-Phase A

تاريخ الإغلاق: ضمن جلسة Mini-Phase A، صفر تعديلات على عقود سابقة.

### Backend
- **DTO جديد:** `sy.gov.sla.identity.api.AssignableLawyerDto`
  `{ id, fullName, username, active }` — لا حقول إضافية.
- **Repo (إضافي):** `UserDepartmentMembershipRepository
  .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(...)`.
- **Service (إضافي):** `UserQueryService.listAssignableLawyers(actor,
  branchId, departmentId, membershipType, activeOnly)` يطبق فحص
  الصلاحية وحدّ الترتيب الأبجدي.
- **Endpoint جديد:**
  `GET /api/v1/users?branchId&departmentId&membershipType=STATE_LAWYER&activeOnly=true`
  ضمن `UsersController` القائم (لا تعديل على `/users/me`).
- **Migration جديد:** `V21__dev_seed_assign_lawyer.sql` (dev seed إضافي،
  مكمِّل لـ V20؛ لا يعدّل V20 ⇒ checksums سليمة).
- **Tests:** `AssignableLawyersApiIT` — 12 اختبارًا تكامليًا يغطي
  المتطلبات الثمانية المطلوبة + 4 سيناريوهات حافة (anonymous،
  state-lawyer caller، missing branchId، missing departmentId).

### Frontend
- **API جديد:** `frontend/src/shared/api/users.ts` — `listAssignableLawyers`
  + نوع `AssignableLawyerOption`.
- **Helper جديد:** `canAssignLawyerForCase` في
  `features/auth/permissions.ts` (مرآة محافظة لقواعد الخادم؛ visual-only).
- **Component جديد:** `features/cases/AssignLawyerSection.tsx` يُحقن داخل
  `CaseDetailPage` وقت أن يكون المستخدم مخوّلًا، مع `lawyerLabel` لاستبدال
  `#userId` باسم المحامي حيثما أمكن.
- **Wiring في `CaseDetailPage`:** أُصلِح أيضًا الانقطاع المتروك من Phase 11
  حول `EditCaseBasicDataModal` (state + import + زر دخول مرتبط بـ
  `canEditCaseBasicData`).
- **Tests:** اختبار `canAssignLawyerForCase` في `permissions.test.ts` +
  `AssignLawyerSection.test.tsx` للـ visibility و loading + success +
  failure.

### Out-of-scope محفوظ
- لا CRUD مستخدمين؛ يبقى Mini-Phase B (`BACKEND_GAP_PHASE11_USER_ADMIN.md`).
- لا توسعة لـ `membershipType` خارج `STATE_LAWYER`.
- لا تغيير لـ `POST /cases/{id}/assign-lawyer`.

### القرار النهائي
ثُبِّت العقد بـ **D-046** في `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`. أي تغيير
لاحق لشكل الـ DTO أو قواعد الصلاحية = قرار جديد D-047+.

