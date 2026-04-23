# IMPLEMENTATION_ROADMAP
## خارطة طريق التنفيذ المرحلي

> القاعدة: لا يجوز تنفيذ مرحلة قبل اكتمال سابقتها وتوثيق ذلك في `PROJECT_PHASE_STATUS.md`.
> كل مرحلة تنتهي بـ: مخرجات قابلة للاختبار + تحديث `PROJECT_PHASE_STATUS.md` + تحديث `NEXT_CHAT_CONTEXT.md`.

---

## المرحلة 0 — Freeze + Foundation
- **الهدف:** تثبيت المرجعية، تهيئة الهيكل، تجميد المتطلبات، إنشاء وثائق المتابعة.
- **المدخلات:** الوثيقتان العربيتان فقط.
- **المخرجات:**
  - مجلدات `backend/`, `frontend/`, `docs/project/`, `docs/project-ui/`.
  - وثائق المتابعة التسع في `docs/project/`.
  - `README.md` للمشروع.
- **ما لا يجب فعله:** أي business module، أي entities/APIs فعلية، أي صفحات frontend.

---

## المرحلة 1 — organization + identity + access-control
- **الهدف:** نمذجة الهيكل التنظيمي، الهوية، الأدوار، الصلاحيات، صلاحيات المحاكم، التفويض.
- **المدخلات:** المرحلة 0 مكتملة، الوثيقة التقنية §5.1–5.2 و§9.
- **المخرجات:**
  - تهيئة مشروع Spring Boot 3 + Java 21 + Flyway + PostgreSQL.
  - كيانات: Branch, Department, Court, User, Role, UserRole, UserDepartmentMembership, UserCourtAccess, UserDelegatedPermission.
  - بذر بيانات الفروع الـ14 وأقسامها الأربعة.
  - APIs: `/auth/*`, `/users/me`, `/branches`, `/branches/{id}/departments`, `/courts`, `/users/{id}/court-access`, `/users/{id}/delegated-permissions`, `/users/{id}/department-memberships`.
  - خدمة Authorization مركزية تطبق قواعد النطاق.
  - اختبارات وحدة وتكاملية لقواعد الصلاحيات.
- **ما لا يجب فعله:** أي منطق دعاوى/جلسات/تنفيذ، أي frontend.

---

## المرحلة 2 — litigation registration + ownership
- **الهدف:** قيد الدعوى الجديدة وتعديل بياناتها الأساسية وإسنادها.
- **المدخلات:** المرحلة 1 مكتملة، الوظيفية §6 والتقنية §5.3 + §8.1–8.2.
- **المخرجات:**
  - كيانات: LitigationCase, CaseStage (الأولى).
  - APIs: `POST /cases`, `GET /cases`, `GET /cases/{id}`, `PUT /cases/{id}/basic-data`, `POST /cases/{id}/assign-lawyer`.
  - تطبيق صارم لقواعد ملكية المحامي وحدود القسم/المحكمة.
  - أحداث: `CaseRegisteredEvent`, `LawyerAssignedEvent`.
  - اختبارات.
- **ما لا يجب فعله:** ترحيل جلسات، فصل، انتقال، تنفيذ، مرفقات، تذكيرات، إشعارات (سوى التهيئة لاستهلاك الحدث لاحقًا)، frontend.

---

## المرحلة 3 — hearing progression + finalization
- **الهدف:** ترحيل الجلسات وفصل الدعوى.
- **المدخلات:** المرحلة 2 مكتملة، الوظيفية §6.5 و§7، التقنية §8.3–8.4.
- **المخرجات:**
  - كيانات: HearingProgressionEntry, CaseDecision.
  - أنواع القرار الحصرية وقائمة أسباب التأجيل المعيارية.
  - APIs: `GET /cases/{id}/stages`, `GET /stages/{id}`, `GET /stages/{id}/progression`, `GET /stages/{id}/hearing-history`, `POST /stages/{id}/rollover-hearing`, `POST /stages/{id}/finalize`.
  - فرض append-only وعدم تعديل السجل السابق.
  - أحداث: `HearingRolledOverEvent`, `CaseFinalizedEvent`.
  - اختبارات.
- **ما لا يجب فعله:** سجل الفصل (Read Model)، الانتقال، التنفيذ، المرفقات، frontend.

---

## المرحلة 4 — resolved register + appeal transition
- **الهدف:** عرض سجل الفصل الشهري ونقل الدعوى إلى الاستئناف.
- **المدخلات:** المرحلة 3 مكتملة، الوظيفية §8 و§9، التقنية §5.3 + §8.5.
- **المخرجات:**
  - APIs: `GET /resolved-register/months`, `GET /resolved-register/{year}/{month}` كـ Read Model مشتق.
  - APIs: `POST /stages/{id}/promote-to-appeal`, `GET /stages/{id}/previous-stage-history`.
  - تحويل المرحلة الأم إلى read-only بعد الاستئناف.
  - اختبارات.
- **ما لا يجب فعله:** التنفيذ، المرفقات، التذكيرات، الإشعارات، frontend.

---

## المرحلة 5 — execution
- **الهدف:** دورة حياة الملف التنفيذي.
- **المدخلات:** المرحلة 4 مكتملة، الوظيفية §10، التقنية §5.4 + §8.6.
- **المخرجات:**
  - كيانات: ExecutionFile, ExecutionAction.
  - APIs: `POST /execution-files`, `GET /execution-files`, `GET /execution-files/{id}`, `POST /execution-files/{id}/actions`, `GET /execution-files/{id}/actions`, `POST /stages/{id}/promote-to-execution`.
  - فرض غياب الجلسات داخل التنفيذ.
  - اختبارات.
- **ما لا يجب فعله:** المرفقات (تأتي في المرحلة 6)، frontend.

---

## المرحلة 6 — attachments + reminders + notifications
- **الهدف:** الوحدات المساندة الأساسية للعمل اليومي.
- **المدخلات:** المرحلة 5 مكتملة، الوظيفية §11–§12، التقنية §5.5–5.6.
- **المخرجات:**
  - Attachments: تخزين، checksum، تحقق نوع/حجم، تنزيل آمن.
  - Reminders: CRUD محدود للمحامي على دعواه.
  - Notifications: استهلاك `CaseRegisteredEvent` على الأقل، APIs قراءة وتعليم كمقروء.
  - APIs المذكورة في الوثيقة التقنية §10.9–10.11.
  - اختبارات.
- **ما لا يجب فعله:** قنوات Email/SMS/Push، frontend.

---

## المرحلة 7 — legal library + public entities + circulars
- **الهدف:** الوحدات المرجعية المساندة.
- **المدخلات:** المرحلة 6 مكتملة، الوظيفية §13–§14 + §16.3، التقنية §5.7.
- **المخرجات:**
  - كيانات وAPIs لكل من المكتبة، الجهات، التعاميم.
  - بحث بالكلمات المفتاحية.
  - بذر بيانات أولية بالتصنيفات المذكورة.
  - اختبارات.
- **ما لا يجب فعله:** أي تكامل خارجي، frontend تشغيلي للأقسام السابقة.

---

## المرحلة 8 — frontend foundation
- **الهدف:** بنية الواجهة الأمامية فقط (Shell + Auth + Routing + Theming RTL).
- **المدخلات:** المراحل 1–7 مكتملة، الوثيقة التقنية §13.
- **المخرجات:**
  - مشروع Vite + React 18 + TS + Tailwind + shadcn/ui RTL.
  - شاشات: تسجيل الدخول، إنشاء حساب، نسيان/إعادة تعيين كلمة المرور، تأكيد OTP.
  - App Shell، التنقل، حماية المسارات، استدعاء `/users/me`.
  - عميل Axios، إعداد TanStack Query، أنماط معالجة الأخطاء.
- **ما لا يجب فعله:** أي شاشات أعمال (تأتي في المرحلة 9).

---

## المرحلة 9 — role-based runtime UI
- **الهدف:** الشاشات التشغيلية وفق الأدوار.
- **المدخلات:** المرحلة 8 مكتملة + كل APIs المراحل السابقة.
- **المخرجات:**
  - لوحة رئيسية حسب الدور.
  - شاشات: قيد دعوى، قائمة دعاوى القسم، قائمة دعاوى المحامي، تفاصيل الدعوى، جلسات اليوم، سجل الفصل، الملفات التنفيذية، المرفقات، التذكيرات، الإشعارات، المكتبة، دليل الجهات، التعاميم، التقارير.
  - Guards الدور لكل مسار وعنصر تفاعلي.
- **ما لا يجب فعله:** اختراع شاشات خارج وصف الوثيقتين.

---

## المرحلة 10 — final verification
- **الهدف:** التحقق النهائي والاستعداد للنشر.
- **المدخلات:** كل ما سبق.
- **المخرجات:**
  - مراجعة شاملة لقواعد الصلاحيات end-to-end.
  - اختبارات تكاملية شاملة لتدفقات الأعمال الكاملة.
  - تقارير الإدارة المركزية/الفرع/القسم.
  - وثيقة "تقرير الجاهزية" + قائمة فجوات معروفة.
  - تحديث جميع وثائق `docs/project/`.
- **ما لا يجب فعله:** إضافة ميزات جديدة خارج النطاق المجمد.

