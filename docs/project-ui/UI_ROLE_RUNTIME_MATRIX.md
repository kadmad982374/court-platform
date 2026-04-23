# UI ROLE RUNTIME MATRIX

> مصفوفة الأفعال الـ runtime في الواجهة بعد Phase 9.
> تُحدَّد فيها مَن يرى الزر، ومَن يُسمح له فعلًا في backend.
>
> ⚠️ **الواجهة فقط تُخفي/تُعطّل** — الفصل النهائي دائمًا على الخادم.

---

## 1) ملاحظات عامة

- "👁" = الزر/العنصر مرئي للمستخدم في UI.
- "🚫" = مرفوض backend (سيعطي 403/422).
- جدول الصلاحيات الكامل في backend راجع `PROJECT_ASSUMPTIONS_AND_DECISIONS.md` D-021..D-042.
- جميع القراءات (لا توجد عمود لها) متاحة لأي مستخدم مصادق عليه + scope الخادم.

---

## 2) Cases-level

| الفعل / الدور | CENTRAL_SUPERVISOR | BRANCH_HEAD | SECTION_HEAD | ADMIN_CLERK (no delegation) | ADMIN_CLERK (+ delegation) | STATE_LAWYER | READ_ONLY_SUPERVISOR | SPECIAL_INSPECTOR |
|---|---|---|---|---|---|---|---|---|
| Promote to appeal      (D-027) | 🚫 | 🚫 | 👁✓ | 🚫 | 👁✓ (PROMOTE_TO_APPEAL) | 🚫 | 🚫 | 🚫 |
| Promote to execution   (D-030) | 🚫 | 🚫 | 👁✓ | 🚫 | 👁✓ (PROMOTE_TO_EXECUTION) | 🚫 | 🚫 | 🚫 |

> الدلالة: Phase 9 لا يعرض الزر إلا للمشار إليهم. backend يطبق نفس القاعدة.

---

## 3) Stage-level

| الفعل / الدور | المحامي المُسنَد | غيره من STATE_LAWYER | SECTION_HEAD | BRANCH_HEAD | ADMIN_CLERK | CENTRAL_SUPERVISOR | READ_ONLY | INSPECTOR |
|---|---|---|---|---|---|---|---|---|
| Rollover hearing (D-024) | 👁✓ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Finalize stage   (D-024) | 👁✓ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

> ملاحظة: الزر يُخفى أيضًا إذا كانت المرحلة `readOnly` أو `stageStatus ∈ {FINALIZED, ARCHIVED, PROMOTED_TO_APPEAL, PROMOTED_TO_EXECUTION}` بصرف النظر عن الدور.
>
> استثناء D-014 `DIRECT_FINALIZE_CASE` للحالات الاستثنائية: **لم يُربط في UI** بعد (backend يدعمه عبر AuthorizationService، لكن نتركه لشاشات الإدارة لاحقًا).

---

## 4) Execution-file-level

| الفعل / الدور | المسؤول المُسنَد للملف | ADMIN_CLERK + ADD_EXECUTION_STEP | غيرهما |
|---|---|---|---|
| Add execution step (D-031/D-032) | 👁✓ | 👁✓ | 🚫 |

> الزر يُخفى أيضًا إذا `file.status ∈ {CLOSED, ARCHIVED}`.

---

## 5) القراءات (read paths)

| الصفحة | من يصل (UI) | فلترة الخادم |
|---|---|---|
| `/cases` (list+detail+stages) | كل مصادق | scope حسب D-021 (الفرع/القسم/المحكمة/الإسناد) |
| `/stages/{id}` (`/progression`, `/hearing-history`) | كل مصادق | scope حسب وحدة `litigationprogression` (D-022) |
| `/resolved-register` | كل مصادق | scope حسب D-025 |
| `/execution-files` | كل مصادق | scope حسب D-028 |
| `/execution-files/{id}/steps` | كل مصادق | scope حسب D-031 |
| `/legal-library`, `/public-entities`, `/circulars` | كل مصادق | D-042 (عام للمصادقين) |

---

## 6) ما هو غير معروض في UI رغم وجوده backend

- `POST /api/v1/cases` (create case)
- `PUT  /api/v1/cases/{id}/basic-data`
- `POST /api/v1/cases/{id}/assign-lawyer`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- جميع endpoints المرفقات/التذكيرات/الإشعارات (Phase 6)
- `GET /api/v1/legal-library/items/{id}` (لا صفحة تفاصيل عنصر)
- `GET /api/v1/public-entities/{id}` (لا صفحة تفاصيل جهة)
- `GET /api/v1/circulars/{id}` (لا صفحة تفاصيل تعميم)

تُؤجَّل لشاشات الإدارة و Phase 10+.

---

## 7) كيفية التحقق Runtime

سيناريو يدوي يجب تشغيله محليًا (لأن Node لا يعمل في بيئة الـ agent):

1. شغّل backend: `mvn spring-boot:run` (في `backend/`).
2. شغّل frontend: `npm install && npm run dev` (في `frontend/`).
3. سجّل دخولًا بـ admin من D-018.
4. تحقّق ظهور التبويبات: عام / الأعمال / مرجعيات في الـ Sidebar.
5. افتح `/cases`. أنشئ دعوى عبر API/sql مسبقًا (لا UI لإنشائها).
6. افتح دعوى. تحقّق:
   - بطاقة "أفعال على مستوى الدعوى" تُظهر/تُخفي الترقيات حسب دورك.
   - جدول المراحل يفتح تفاصيل المرحلة.
7. افتح مرحلة. كَن المحامي المُسنَد لتختبر Rollover/Finalize.
8. افتح `/resolved-register`. جرّب الفلاتر.
9. افتح `/execution-files`. افتح ملفًا. كَن `assignedUserId` لتُضيف خطوة.
10. كرر مع admin_clerk + delegation لتأكيد ظهور الترقيات/الإضافة.

