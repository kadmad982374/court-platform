# UI BUSINESS PAGES — Phase 9

> Phase 9 من خطة المشروع. الهدف: تحويل الواجهة من foundation (Phase 8) إلى
> **business UI usable** للمسارات الأهم: الدعاوى، تفاصيل الدعوى، تقدّم
> المرحلة، سجل الفصل، التنفيذ — مع احترام صارم للأدوار والصلاحيات.
>
> **Backend لم يُعدَّل.** صفر migrations، صفر endpoints جديدة، صفر تعديل عقود.

---

## 1) النطاق المعتمَد لـ Phase 9

داخل النطاق:
- صفحات الأعمال التالية مربوطة فعليًا بـ backend الموجود:
  - `CasesListPage` ← `GET /api/v1/cases`
  - `CaseDetailPage` ← `GET /api/v1/cases/{id}` + `GET /api/v1/cases/{id}/stages`
  - `StageDetailPage` ← `GET /api/v1/stages/{stageId}` + `/progression` + `/hearing-history`
  - `ResolvedRegisterPage` ← `GET /api/v1/resolved-register`
  - `ExecutionFilesPage` ← `GET /api/v1/execution-files`
  - `ExecutionFileDetailPage` ← `GET /api/v1/execution-files/{id}` + `/steps`
- أفعال محمية بـ role/delegation:
  - **Rollover** ← `POST /api/v1/stages/{stageId}/rollover-hearing`
  - **Finalize** ← `POST /api/v1/stages/{stageId}/finalize`
  - **Promote-to-Appeal** ← `POST /api/v1/cases/{caseId}/promote-to-appeal`
  - **Promote-to-Execution** ← `POST /api/v1/cases/{caseId}/promote-to-execution`
  - **Add execution step** ← `POST /api/v1/execution-files/{id}/steps`
- Helper مركزي للصلاحيات (`features/auth/permissions.ts`).
- إضافة مكوّنات UI primitives مفقودة: `Table`, `Modal`, `Select`, `Textarea`.
- إضافة `extractApiErrorMessage` لتوحيد عرض رسائل الخطأ من backend.
- توسيع navigation بثلاثة عناصر فقط: الدعاوى / سجل الفصل / التنفيذ.
- إصلاح mismatch في `DelegatedPermission` (Phase 8 كانت `permissionCode`،
  backend الفعلي `code` + `grantedByUserId` + `grantedAt`) — frontend فقط.

خارج النطاق (مؤجَّل لـ Phase 10+):
- صفحات المرفقات (upload/download).
- صفحات التذكيرات الكاملة.
- صفحات الإشعارات التفصيلية.
- شاشات إدارية للمكتبة/الدليل/التعاميم.
- إنشاء/تعديل دعوى من UI (لم يُربط `POST /cases` ولا `PUT /basic-data` ولا
  `POST /assign-lawyer` — backend موجود لكن النموذج يحتاج فيلد كثيرة منظَّمة
  وفلسفة UX خاصة بـ ADMIN_CLERK، نؤجلها مع شاشات الإدارة).
- forgot/reset password screens.
- toast system موحَّد (الأخطاء حاليًا inline داخل كل صفحة).

---

## 2) الصفحات التي أصبحت usable فعليًا

| Route | الصفحة | يربط بـ | عرض/تحرير |
|---|---|---|---|
| `/cases`                        | `CasesListPage`         | `GET /cases` (page+size) | جدول + pagination |
| `/cases/:caseId`                | `CaseDetailPage`        | `GET /cases/{id}`، `GET /cases/{id}/stages`، `POST /cases/{id}/promote-to-appeal`، `POST /cases/{id}/promote-to-execution` | بطاقات + جدول مراحل + modal ترقية للتنفيذ |
| `/stages/:stageId`              | `StageDetailPage`       | `GET /stages/{id}`، `/progression`، `/hearing-history`، `POST /stages/{id}/rollover-hearing`، `POST /stages/{id}/finalize` | بطاقات + جدول سجل + modal rollover + modal finalize |
| `/resolved-register`            | `ResolvedRegisterPage`  | `GET /resolved-register?year&month&branchId&departmentId&decisionType` | فلاتر + جدول read-only |
| `/execution-files`              | `ExecutionFilesPage`    | `GET /execution-files` | فلاتر + جدول |
| `/execution-files/:id`          | `ExecutionFileDetailPage` | `GET /execution-files/{id}`، `/steps`، `POST /execution-files/{id}/steps` | بطاقات + timeline + modal إضافة خطوة |

---

## 3) خريطة الصلاحيات (UI vs Backend)

> الواجهة تُخفي/تُعطّل الأزرار حسب القواعد التالية. **الفصل النهائي على الخادم**.
> راجع `UI_ROLE_RUNTIME_MATRIX.md` لمصفوفة كاملة.

### Rollover hearing — D-024
- **يظهر** زر "ترحيل الجلسة" فقط إذا:
  - `user.id === stage.assignedLawyerUserId`
  - **و** المرحلة ليست `readOnly`
  - **و** `stageStatus ∉ {FINALIZED, ARCHIVED, PROMOTED_TO_APPEAL, PROMOTED_TO_EXECUTION}`
- خارجًا، Backend سيُعيد 403/422؛ الرسالة تُعرض inline.

### Finalize stage — D-024
- نفس قواعد Rollover (المحامي المُسنَد فقط).

### Promote to appeal — D-027
- **يظهر** فقط إذا:
  - `roles.includes('SECTION_HEAD')`
  - **أو** `roles.includes('ADMIN_CLERK')` **و** `delegatedPermissions` تحتوي على
    `code='PROMOTE_TO_APPEAL'` مع `granted=true`.

### Promote to execution — D-030
- **يظهر** فقط إذا:
  - `roles.includes('SECTION_HEAD')`
  - **أو** `roles.includes('ADMIN_CLERK')` **و** `code='PROMOTE_TO_EXECUTION'` ممنوحة.

### Add execution step — D-031/D-032
- **يظهر** فقط إذا:
  - `user.id === file.assignedUserId` (المالك بعد الترقية)
  - **أو** `roles.includes('ADMIN_CLERK')` **و** `code='ADD_EXECUTION_STEP'` ممنوحة
- **و** `file.status ∉ {CLOSED, ARCHIVED}`.

### القراءات
- جميع القراءات (cases/stages/execution/resolved-register) لا تُقيِّد UI؛ الخادم
  يفلتر النطاق (D-021/D-027/D-030/...) ونحن نعرض ما يأتي. UI لا يُكرّر منطق scope.

---

## 4) التعامل مع الأخطاء

- كل mutation يستخدم `extractApiErrorMessage(err)` لاستخراج `body.message ?? body.code`
  من الـ `ApiErrorBody` القياسي.
- تُعرض inline داخل بطاقة حمراء فوق البطاقات (`role="alert"`).
- لا توجد محاولات الالتفاف على الرفض من الخادم (لا "نخدع" المستخدم).
- لا توجد أي عملية optimistic update تكسر اتساق الحالة.

---

## 5) Mismatches/Gaps موثّقة (لم نُعدّل backend)

### Gap #1 — لا endpoint عام لقائمة `PostponementReasons`
- `PostponementReason` Reference Table موجودة backend (`PostponementReasonRepository`)
  لكن لا يوجد `GET /api/v1/postponement-reasons` يكشفها للواجهة.
- **المعالجة الحالية في UI:** نموذج Rollover يستقبل **رمز السبب نصًا** مع تنبيه
  واضح. الخادم سيرفض رمزًا غير معروف برسالة خطأ تُعرض inline.
- **التوصية:** إضافة endpoint قراءة بسيط لاحقًا (Phase backend صغير) — قرار جديد
  D-046 إن لزم.

### Gap #2 — حقول `delegatedPermissions[]` في `/users/me`
- وجدنا في Phase 9 أن backend يستخدم `code` (`DelegatedPermissionCode`) بدلًا من
  `permissionCode` الذي افترضناه في Phase 8.
- **معالجة:** أصلحنا `frontend/src/shared/types/domain.ts` فقط.
  Backend لم يُلمَس.

### Gap #3 — لا يوجد endpoint لقائمة المستخدمين في الواجهة
- `assign-lawyer` يحتاج `lawyerUserId`؛ لا يوجد لدينا UI لاختيار المحامي بدون
  endpoint قراءة users بـ scope مناسب.
- **المعالجة الحالية:** لم نَبْنِ "إسناد محامٍ من UI" في Phase 9 (مؤجَّل).
  backend `POST /cases/{id}/assign-lawyer` موجود لكن لم يُربط من UI.

### Gap #4 — لا CRUD UI لإنشاء/تعديل الدعوى
- backend يدعم `POST /cases` و `PUT /cases/{id}/basic-data` و `POST /cases/{id}/assign-lawyer`،
  لكن النموذج يحتاج 12+ حقلًا منظمة وارتباط بفروع/أقسام/محاكم — سنبنيه عند بناء
  شاشات الإدارة الكاملة (Phase 11 المقترح).

### Gap #5 — لا تشغيل tooling في بيئة الـ agent
- Node.js غير مثبَّت بشكل صحيح في النظام (`C:\Program Files\nodejs` يحوي فقط
  `npx*`؛ لا `node.exe` ولا `npm.cmd`).
- **التحقق المحلي المطلوب** بعد سحب التغييرات:
  ```
  cd frontend
  npm install
  npm run lint
  npm run build      # tsc -b && vite build
  npm run test
  ```
- الكود مكتوب TypeScript strict-clean بأفضل ما يمكن من الفحص اليدوي.

---

## 6) تغييرات على بنية المجلدات (إضافات Phase 9)

```
src/
  features/
    cases/                   # ✚ جديد
      api.ts                       # GET/POST cases-level
      stagesApi.ts                 # GET/POST stages-level
      CasesListPage.tsx
      CaseDetailPage.tsx
      StageDetailPage.tsx
    resolvedregister/        # ✚ جديد
      ResolvedRegisterPage.tsx
    execution/               # ✚ جديد
      api.ts
      ExecutionFilesPage.tsx
      ExecutionFileDetailPage.tsx
    auth/
      permissions.ts               # ✚ جديد — UI gates (D-024/27/30/31)
      permissions.test.ts          # ✚ جديد
  shared/
    ui/
      Table.tsx                    # ✚ جديد
      FormFields.tsx               # ✚ جديد (Select + Textarea)
      Modal.tsx                    # ✚ جديد
    lib/
      apiError.ts                  # ✚ جديد
    types/
      domain.ts                    # ✎ مُحدَّث (Phase 9 types + DelegatedPermission fix)
  app/
    router.tsx                     # ✎ مُحدَّث (مسارات Phase 9)
  features/navigation/
    navItems.ts                    # ✎ مُحدَّث (3 عناصر Phase 9)
    navItems.test.ts               # ✎ مُحدَّث
```

---

## 7) ما الذي ما زال غير موجود في UI

- إنشاء/تعديل/إسناد محامٍ على الدعوى (backend جاهز).
- DELETE/PUT أي شيء من Phase 7 (مرفوض D-040..D-042 أصلًا).
- attachments / reminders / notifications.
- شاشة users/admin.

---

## 8) قرارات
- **لم يُضَف D-046+** في Phase 9. كل الإصلاحات وصفية UI خالصة (Gap #2)، أو
  تعزيز توصيف موجود (D-024/D-027/D-030/D-031). أي قرار جديد لاحقًا (مثل
  استبدال localStorage، أو إضافة postponement-reasons endpoint) يُسجَّل D-046+.

