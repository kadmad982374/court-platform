# FINAL_REQUIREMENTS_TRACEABILITY
## مصفوفة التتبع النهائية للمتطلبات → التنفيذ

> لكل متطلب أساسي: حالته، أين نُفِّذ في backend، أين نُفِّذ في frontend،
> القرار/القرارات الحاكمة، وأي gap موثَّق.
>
> **تحديث (Mini-Phase A — D-046):** صفّ الإسناد + UI الإسناد ⇒ COMPLETE،
> وعرض الاسم بدل `#id` ⇒ PARTIAL (مغطّى في `CaseDetailPage` فقط، لم يُربط
> بعدُ في `StageDetailPage` و `ExecutionFileDetailPage` — تحسين بصري لا
> يمنع pilot/production). راجع §4 و §10.
>
> **مفاتيح الحالة:**
> - **COMPLETE** — Backend + Frontend كلاهما يعمل end-to-end.
> - **PARTIAL** — Backend مكتمل لكن UI غير مكتمل (أو العكس)، أو يوجد قيد
>   مقبول موثَّق.
> - **NOT STARTED** — لم يُبنَ في أي من الطرفين.
> - **DEFERRED BY DESIGN** — متروك عمدًا بقرار صريح، ليس gap.

---

## 1) الـ Identity / Auth / Access

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| تسجيل الدخول | COMPLETE | `POST /auth/login` (Phase 1) | `/login` | D-012 | — |
| تجديد التوكن | COMPLETE | `POST /auth/refresh-token` rotation | http interceptor single-flight | D-019 | — |
| تسجيل الخروج | COMPLETE | `POST /auth/logout` | header زر | D-019 | — |
| ملفي الشخصي | COMPLETE | `GET /users/me` | `/profile` | — | — |
| Forgot password (طلب OTP) | PARTIAL | `POST /auth/forgot-password` | `/forgot-password` | D-013 | OTP يطبع للـ console — لا مزود SMS فعلي |
| Reset password | COMPLETE | `POST /auth/reset-password` + إبطال refresh tokens | `/reset-password` | D-013 + D-019 | — |
| Bootstrap CENTRAL_SUPERVISOR | COMPLETE | `BootstrapAdminRunner` | — | D-018 | يجب تعطيله في الإنتاج |
| User admin (CRUD مستخدمين/أدوار/عضويات/تفويضات) | NOT STARTED | لا endpoints | لا شاشات | — | gap موثَّق: `BACKEND_GAP_PHASE11_USER_ADMIN.md` — عائق production |
| Court access management | NOT STARTED | لا endpoints | لا UI | — | جزء من gap user admin |

---

## 2) قيد الدعوى (Litigation registration)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| إنشاء دعوى | COMPLETE | `POST /cases` (Phase 2) | `/cases/new` (Phase 11) | D-020, D-021 | لـ SECTION_HEAD أو ADMIN_CLERK + CREATE_CASE |
| تخزين تاريخ الجلسة الأولى وسبب التأجيل الأول | COMPLETE | حقول انتقالية على `case_stages` | حقل نص حر في CreateCasePage | D-020 | dropdown غير متاح ⇒ نص حر مقبول حسب D-020 |
| migration ترحيل D-020 إلى INITIAL entry | COMPLETE | `V11__backfill_initial_progression.sql` | — | D-022 | — |
| استعراض الدعاوى مع scope | COMPLETE | `GET /cases` | `/cases` | D-021 | — |
| تفاصيل دعوى | COMPLETE | `GET /cases/{id}` + `/stages` | `/cases/:id` | D-021 | — |

---

## 3) تعديل البيانات الأساسية

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| تعديل البيانات الأساسية للدعوى | COMPLETE | `PUT /cases/{id}/basic-data` (Phase 2) | `EditCaseBasicDataModal` (Phase 11) | D-006 | diff على الحقول المتغيّرة فقط |
| `originalRegistrationDate` immutable | COMPLETE (DEFERRED BY DESIGN لأي تعديل) | لا API لتعديله | حقل مستثنى صراحة في UI | D-006 | إصلاح خطأ = إلغاء + إنشاء |

---

## 4) إسناد المحامي

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| Endpoint الإسناد | COMPLETE | `POST /cases/{id}/assign-lawyer` (Phase 2) | `AssignLawyerSection` (Mini-Phase A) | D-021 + ASSIGN_LAWYER + **D-046** | يقبل `lawyerUserId: number` — تُختار من dropdown مفلتر |
| UI الإسناد | COMPLETE (Mini-Phase A) | `GET /api/v1/users` (D-046) | `AssignLawyerSection` في `CaseDetailPage` | **D-046** | dropdown مُفلتر بـ branch/dept؛ visual gate `canAssignLawyerForCase` |
| عرض اسم المحامي بدل #id | PARTIAL | `GET /api/v1/users` (D-046) | `lawyerLabel` في `CaseDetailPage` (حقل المالك + جدول المراحل) فقط | **D-046** | لم يُربط بعدُ في `StageDetailPage` و `ExecutionFileDetailPage` — تحسين بصري لاحق لا يمنع pilot |

---

## 5) الجلسات (Hearing progression)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| ترحيل جلسة (rollover) | COMPLETE | `POST /stages/{id}/rollover-hearing` (Phase 3) | زر في `StageDetailPage` | D-022, D-024 | للمحامي المُسنَد فقط |
| append-only للـ entries | COMPLETE | 4 طبقات إكراه (Domain/Repo/API/Test) | لا UPDATE في UI | D-022 | — |
| سرد سجل الجلسات | COMPLETE | `GET /stages/{id}/progression`, `/hearing-history` | في `StageDetailPage` | — | — |
| Reference Table أسباب التأجيل | PARTIAL | جدول DB + بذر V11 | dropdown غير متاح | D-008, D-020 | gap: لا `GET /postponement-reasons` (HTTP). Phase 11 يستخدم نص حر مطابق لـ D-020 |

---

## 6) الفصل (Decision finalization)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| Endpoint الفصل | COMPLETE | `POST /stages/{id}/finalize` (Phase 3) | modal فصل في `StageDetailPage` | D-024 | للمحامي المُسنَد فقط |
| `DecisionType` مغلق | COMPLETE | enum 4 قيم | dropdown 4 قيم | D-009 | لا توسعة |
| الفصل المباشر دون إحالة | DEFERRED BY DESIGN | لا API/مسار مستقل | — | D-005 | يحتاج تفويض مخصَّص — out of scope phase 1..11 |
| تصحيح بيانات دعوى مفصولة | DEFERRED BY DESIGN | لا API | — | D-007 | تأجيل صريح؛ لم يطلبه FUNCTIONAL_SCOPE في Phase 1..7 |

---

## 7) سجل الفصل (Resolved register)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| سجل الفصل الشهري | COMPLETE | `GET /resolved-register` Read Model (Phase 4) | `/resolved-register` | D-001, D-025 | لا projection table |
| الفلاتر (سنة/شهر/فرع/قسم/decisionType) | COMPLETE | معلمات الـ endpoint | UI كامل | D-025 | — |
| التصدير | COMPLETE | — (يُنفَّذ من UI على البيانات المُحمَّلة) | زر تصدير | — | — |

---

## 8) الاستئناف (Appeal)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| ترقية إلى الاستئناف | COMPLETE | `POST /cases/{id}/promote-to-appeal` (Phase 4) | زر في `CaseDetailPage` | D-002, D-026, D-027 | SECTION_HEAD أو ADMIN_CLERK+PROMOTE_TO_APPEAL |
| المرحلة الأم تصبح read-only | COMPLETE | `is_read_only=true`, status `PROMOTED_TO_APPEAL` | UI يعكس ذلك (لا أزرار rollover/finalize) | D-002 | — |
| لا قيد على `decisionType` | COMPLETE | محافظ بقصد | — | D-026 | — |

---

## 9) التنفيذ (Execution)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| ترقية إلى التنفيذ | COMPLETE | `POST /cases/{id}/promote-to-execution` (Phase 5) | modal في `CaseDetailPage` | D-029, D-030, D-033, D-034 | SECTION_HEAD أو ADMIN_CLERK+PROMOTE_TO_EXECUTION |
| `ExecutionFile` كيان مستقل | COMPLETE | `execution_files` | `/execution-files`, `/execution-files/:id` | D-003, D-028 | — |
| خطوات تنفيذ append-only | COMPLETE | `execution_steps` (4 طبقات إكراه) | إضافة فقط، لا UPDATE/DELETE | D-031 | — |
| إضافة خطوة | COMPLETE | `POST /execution-files/{id}/steps` | UI في `ExecutionFileDetailPage` | D-030, D-031, D-032 | assignedUserId أو ADMIN_CLERK+ADD_EXECUTION_STEP |
| Read scope للتنفيذ | COMPLETE | `ExecutionScope` (Phase 5) | يعتمده UI | D-032 | — |
| إغلاق ملف تنفيذي تلقائي | NOT STARTED | لا lifecycle محرَّك | — | — | lifecycle CLOSED غير مُحرَّك تلقائيًا — موثَّق |

---

## 10) المرفقات (Attachments)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| رفع/قائمة/تنزيل لمرفقات المرحلة | COMPLETE | Phase 6 | `AttachmentsSection` في `StageDetailPage` | D-035, D-036 | حد 50MB UI-side |
| رفع/قائمة/تنزيل لمرفقات ملف التنفيذ | COMPLETE | Phase 6 | `AttachmentsSection` في `ExecutionFileDetailPage` | D-035, D-036 | — |
| رفع لـ `EXECUTION_STEP` scope | NOT STARTED | لا upload endpoint بهذا النطاق | — | D-035 | غير مطلوب من FUNCTIONAL_SCOPE |
| Local filesystem | COMPLETE (DEFERRED BY DESIGN لـ S3) | `LocalFilesystemAttachmentStorage` | — | D-035 | يحتاج استبدال بـ S3/MinIO قبل الإنتاج |
| DELETE / PUT للمرفقات | DEFERRED BY DESIGN | غير موجود | غير معروض | D-036, D-039 | — |
| Anti-virus | DEFERRED BY DESIGN | غير موجود | — | D-035, D-039 | لازم قبل production |

---

## 11) التذكيرات (Reminders)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| إنشاء/قراءة تذكير شخصي | COMPLETE | `POST/GET /cases/{id}/reminders` (Phase 6) | `RemindersSection` في `CaseDetailPage` | D-037 | شخصية فقط |
| تحديث الحالة (DONE/CANCELLED) | COMPLETE | `PATCH /reminders/{id}/status` | UI يدعم | D-037 | على PENDING فقط |
| Re-open بعد DONE/CANCELLED | DEFERRED BY DESIGN | مرفوض (400) | UI يخفي | D-037 | — |
| Shared reminders | DEFERRED BY DESIGN | غير موجود | — | D-037 | قرار جديد إن لزم |
| Scheduler / due notification | DEFERRED BY DESIGN | غير موجود | — | D-039 | لازم لاحقًا |

---

## 12) الإشعارات (Notifications)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| `CASE_REGISTERED` للمحامي والقسم | COMPLETE | listener في Phase 6 | `/notifications` | D-010, D-038 | — |
| `LAWYER_ASSIGNED` للمحامي | COMPLETE | listener في Phase 6 | `/notifications` | D-038 | — |
| إشعارات الأدوار الإشرافية | DEFERRED BY DESIGN | غير موجود | — | D-016, D-038 | محافظ بقصد |
| إشعارات لـ promote/finalize/step | DEFERRED BY DESIGN | غير موجود | — | D-038 | قرار جديد إن لزم |
| Mark as read | COMPLETE | `PATCH /notifications/{id}/read` | UI | D-038 | للمالك فقط |
| Pagination | COMPLETE | `?page=&size=` + `PageResponse<T>` | UI | — | — |
| POST يدوي / DELETE | DEFERRED BY DESIGN | غير موجود | غير معروض | D-038 | — |
| قنوات خارجية (Email/SMS/Push) | DEFERRED BY DESIGN | — | — | D-039 | لازم قبل production |
| WebSocket / SSE realtime | DEFERRED BY DESIGN | — | — | D-039 | — |

---

## 13) المكتبة القانونية

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| فئات هرمية | COMPLETE | `LegalCategory` (Phase 7) | `/legal-library` | D-040 | — |
| عناصر مكتبة + بحث | COMPLETE | `LegalLibraryItem` + Specifications + ILIKE | UI قائمة + فلاتر | D-040, D-041 | — |
| صفحة تفاصيل عنصر | COMPLETE | `GET /legal-library/items/{id}` | `/legal-library/items/:id` | D-042 | — |
| CRUD إداري / workflow | DEFERRED BY DESIGN | غير موجود | — | D-040, D-042 | — |
| Full-text engine | DEFERRED BY DESIGN | ILIKE فقط | — | D-041 | — |

---

## 14) دليل الجهات (Public entity directory)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| فئات + عناصر + بحث | COMPLETE | Phase 7 | `/public-entities` | D-040, D-041 | — |
| صفحة تفاصيل جهة | COMPLETE | `GET /public-entities/{id}` | `/public-entities/:id` | D-042 | — |
| ربط الجهة بدعوى عبر FK | DEFERRED BY DESIGN | الدعوى تخزن نص الجهة | — | D-011 | لا إلزام |

---

## 15) التعاميم (Circulars)

| المتطلب | الحالة | Backend | Frontend | القرارات | ملاحظات |
|---------|--------|---------|----------|---------|---------|
| CRUD-قراءة + بحث + فلاتر | COMPLETE | Phase 7 | `/circulars` | D-040, D-041 | — |
| `CircularSourceType` محصور | COMPLETE | enum + DB CHECK | dropdown مغلق | D-040 | MoJ + SLA فقط |
| صفحة تفاصيل تعميم | COMPLETE | `GET /circulars/{id}` | `/circulars/:id` | D-042 | — |
| إدارة CRUD | DEFERRED BY DESIGN | — | — | D-040, D-042 | — |

---

## 16) Cross-cutting / NFR

| المتطلب | الحالة | ملاحظات |
|---------|--------|---------|
| Audit عام | COMPLETE | يُسجَّل في كل phase |
| Error handling عربي مركزي | COMPLETE | في backend + UI |
| RTL Arabic-first | COMPLETE | D-014 |
| API versioning `/api/v1` | COMPLETE | D-015 |
| Migrations Flyway V1..V19 + V20 dev seed | COMPLETE | V20 يجب حذفه قبل الإنتاج |
| JWT + Refresh rotation | COMPLETE | D-019 |
| Token storage frontend | PARTIAL | localStorage خلف Port (D-044) — httpOnly cookies = D-046+ لاحقًا |
| HTTPS / CORS / rate limiting | NOT STARTED | لازم قبل production |
| Object storage (S3/MinIO) | NOT STARTED | بديل local filesystem (D-035) |
| Backup/restore | NOT STARTED | لازم قبل production |
| Secrets management | NOT STARTED | لازم قبل production |
| Anti-virus على المرفقات | NOT STARTED | D-035 + D-039 |
| SMS provider لـ OTP | NOT STARTED | D-013 |

---

## 17) ملخص الإحصاءات

- **COMPLETE end-to-end:** 26 متطلبًا.
- **PARTIAL (مقبول/موثَّق):** 4 متطلبات.
- **NOT STARTED (gap محدد):** 11 متطلبًا (تنقسم على gap docs الثلاث + NFR
  للإنتاج).
- **DEFERRED BY DESIGN (قرار صريح):** 18 بندًا.

نسبة المتطلبات الوظيفية الأساسية المكتملة (دون NFR): ~85% من
FUNCTIONAL_SCOPE الذي تمت معالجته في Phases 1..7. النسبة العالية لا تعني
production-readiness — انظر `FINAL_PRODUCTION_BLOCKERS.md`.



