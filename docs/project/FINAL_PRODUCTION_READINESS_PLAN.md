# FINAL_PRODUCTION_READINESS_PLAN
## خطة الوصول إلى Production-Readiness

> هذه الخطة **لا تُنفَّذ تلقائيًا**. يجب أن يصدر قرار صريح من المالك ببدء أي
> mini-phase مذكورة هنا، مع تخصيص قرار D-046+ موثَّق لأي تغيير في
> العقود/السياسات.
>
> ترتيب البنود من الأهم وظيفيًا إلى الأكثر «ops». لا يجوز ادعاء
> production-readiness قبل إنجاز كل البنود المُعلَّمة **MANDATORY**.

---

## 1) Backend Mini-Phase A — Assign Lawyer (MANDATORY)

**هدف:** إكمال دورة إسناد المحامي على الواجهة.

**المرجع:** `BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md`.

**الحجم المقدَّر:** 1–2 يوم.

**المخرجات:**
- Endpoint جديد: `GET /api/v1/users` (read-only، scoped).
  ```
  GET /api/v1/users?branchId=&departmentId=&membershipType=STATE_LAWYER&activeOnly=true
  → [{ id, fullName, username, active }]
  ```
- صلاحية: `SECTION_HEAD` لعضوية فعّالة في `(branchId, departmentId)`، أو
  `ADMIN_CLERK` لها مع `ASSIGN_LAWYER` delegated. أي دور آخر ⇒ 403.
- عدم تعريض `mobileNumber` أو `delegatedPermissions` أو أي حقل غير
  ضروري.
- اختبارات تكامل: 200 للمسموح، 403 للممنوع، فلترة active صحيحة.
- **قرار جديد D-046**: شكل الاستجابة + قواعد الصلاحية + قابلية توسعة
  `membershipType`.

**UI sub-phase (نصف يوم):**
- `AssignLawyerSection` داخل `CaseDetailPage` (إسناد + تغيير).
- استبدال `#userId` بالاسم الفعلي في كل صفحات الأعمال.
- تحديث `BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md` ⇒ مغلق.

---

## 2) Backend Mini-Phase B — User / Role / Membership / Delegation Admin (MANDATORY)

> **حالة 2026-04:** ✅ **Backend = DONE** (D-047 + D-048 مثبَّتان؛ 22 IT
> أخضر؛ صفر migrations؛ صفر تعديلات على عقود Mini-Phase A أو الـ bulk
> القائمة). ✅ **UI sub-phase B (`/admin/users` + `/admin/users/:id`
> minimal) = COMPLETED** — قائمة + إنشاء + تفعيل/تعطيل + 4 sections
> (roles / memberships / delegations / court-access) + 22 unit test
> أخضر. **عائق User Admin = مُغلَق بالكامل.** الخطوة التالية الموصى بها
> = §3..§15 أدناه (production hardening).

**هدف:** إغلاق العائق الأكبر — لا production بدون إدارة مستخدمين.

**المرجع:** `BACKEND_GAP_PHASE11_USER_ADMIN.md` (انظر §«التنفيذ الفعلي»).

**الحجم المنفَّذ:** ~يوم backend + 22 IT + UI sub-phase B (22 unit test).
**المتبقي في هذا البند:** صفر — مكتمل.

**المخرجات backend (تم تسليمها):**

### 2.1 Users CRUD محدود ✅
- `POST /api/v1/users` (CreateUserRequest, validation, BCrypt) ✅
- `PATCH /api/v1/users/{id}` (active, fullName, mobileNumber) ✅
- `GET /api/v1/users/{id}` (UserAdminDto) ✅
- `GET /api/v1/users` paginated مع فلاتر role / branchId / departmentId / active / q ✅
- D-047 ⇒ كلمة المرور الأولية في الجسم؛ السلسلة `ChangeMe!2026` مرفوضة.

### 2.2 Roles ✅
- `POST/DELETE /api/v1/users/{id}/roles[/{role}]` ✅ (CENTRAL_SUPERVISOR فقط).
- D-048 ⇒ حارس صريح ضد BRANCH_HEAD يمنح BRANCH_HEAD مع رمز خطأ
  `BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD`.

### 2.3 Department memberships ✅
- `POST/PATCH /api/v1/users/{id}/department-memberships[/{mid}]` ✅.
- CENTRAL_SUPERVISOR لكل فرع؛ BRANCH_HEAD لفرعه فقط؛ نوع `BRANCH_HEAD`
  مقتصر على المركزي (D-048).

### 2.4 Delegated permissions ✅
- `POST/PATCH /api/v1/users/{id}/delegated-permissions[/{pid}]` ✅.
- SECTION_HEAD لقسمه فقط على ADMIN_CLERK نشط (تأكيد D-004) +
  CENTRAL_SUPERVISOR.

### 2.5 Court access ✅
- `POST/DELETE /api/v1/users/{id}/court-access[/{caid}]` ✅ (granular)؛
  حذف منطقي (`active=false`)؛ duplicate active = `409
  COURT_ACCESS_DUPLICATE`.
- مسار `PUT /court-access` الـ bulk القائم لم يُلمَس.

**UI sub-phase (المتبقي — لم يبدأ):**
- `/admin/users` قائمة + بحث + إنشاء + تفعيل/تعطيل.
- `/admin/users/:id` tabs: roles / memberships / delegations / court access.
- gating كامل في navigation (CENTRAL_SUPERVISOR فقط يرى `/admin`).

---

## 3) Token Security — httpOnly Cookies (MANDATORY)

**هدف:** إنهاء الاعتماد على `localStorage` لتخزين التوكن (D-044).

**المرجع:** `FINAL_PRODUCTION_BLOCKERS.md` §4.

**المخرجات:**
- **قرار D-049+**: شكل الـ cookie (Secure, HttpOnly, SameSite=Strict)،
  CSRF strategy (double-submit أو header-based)، توافق refresh.
- Backend: تعديل `/auth/login` و `/auth/refresh-token` و `/auth/logout`
  لإصدار/قراءة/حذف cookies.
- Frontend: `tokenStorage` Port يصبح no-op؛ `http` interceptor يُزال
  منه إضافة الـ Bearer header؛ التعامل مع 401 يبقى كما هو.
- اختبار CSRF عبر مسارات الكتابة.

---

## 4) Object Storage للمرفقات (MANDATORY)

**هدف:** بديل local filesystem.

**المرجع:** D-035 + `FINAL_PRODUCTION_BLOCKERS.md` §5.

**المخرجات:**
- `S3AttachmentStorage` adapter ينفّذ `AttachmentStoragePort` (الـ Port
  جاهز).
- إعداد: bucket policy، KMS، lifecycle، versioning.
- لا حاجة لقرار جديد إن لم يتغير شكل `storage_key` ولا الحد 50MB.
  وإلا D-050+.
- اختبار: رفع، قراءة، تنزيل، size — كلها عبر S3.

---

## 5) Anti-Virus على المرفقات (MANDATORY)

**هدف:** فحص الملفات قبل قبولها.

**المخرجات:**
- مكوّن `AttachmentScannerPort` جديد + adapter (مثل ClamAV).
- في `AttachmentService.upload`: فحص قبل التخزين النهائي. الفشل ⇒ 422
  `INFECTED_FILE`.
- ⇒ **قرار D-051+**: سياسة الفشل، الـ quarantine.

---

## 6) قنوات إشعار خارجية + Scheduler (MANDATORY إن طُلب التذكير الفعلي)

**هدف:** التذكيرات تذكِّر فعليًا + إشعارات تصل خارج النظام.

**المرجع:** D-039 + `FINAL_PRODUCTION_BLOCKERS.md` §7.

**المخرجات:**
- `@Scheduled` job يحوّل `Reminder` (PENDING + due) إلى `Notification`.
- `EmailSenderPort` + `SmsSenderPort` (الموجود لـ OTP يمكن إعادة استخدامه)
  + `PushSenderPort` (اختياري).
- `NotificationDispatcher` يقرر القناة بحسب نوع الإشعار + تفضيلات
  المستخدم.
- ⇒ **قرار D-052+**: القنوات لكل نوع إشعار + تفضيلات المستخدم.

---

## 7) SMS Provider لـ OTP (MANDATORY)

**هدف:** forgot/reset password يعمل ذاتيًا.

**المرجع:** D-013 + `FINAL_PRODUCTION_BLOCKERS.md` §6.

**المخرجات:**
- تنفيذ `SmsSenderPort` بمزود فعلي.
- secrets management للـ credentials.
- rate limiting صارم على `/auth/forgot-password` (مثلاً 3/ساعة لكل رقم).
- monitoring فشل الإرسال.

---

## 8) Backup / Restore / DR (MANDATORY)

**المخرجات:**
- `pg_dump` مجدول يومي + أسبوعي + شهري، مع retention policy.
- نسخ مجلد `attachments-data` (أو S3 versioning + cross-region replication).
- اختبار restore فعلي **مرة على الأقل** قبل الإنتاج، موثَّق.
- runbook الاسترجاع عند الكوارث.

---

## 9) Secrets Management (MANDATORY)

**هدف:** إخراج الـ secrets من `application.yml` و env vars خام.

**المخرجات:**
- اختيار مزود (Vault / AWS Secrets Manager / k8s Secrets / Doppler).
- نقل: JWT secret، DB password، SMS provider creds، S3 keys.
- rotation policy موثَّقة.

---

## 10) Rate Limiting + Abuse Protection (MANDATORY)

**المخرجات:**
- على `/auth/login`: مثلاً 10/دقيقة لكل IP + 5/دقيقة لكل username.
- على `/auth/forgot-password`: 3/ساعة لكل mobileNumber.
- على `/auth/reset-password`: 5/ساعة لكل mobileNumber.
- على endpoints الكتابة العامة: حد عام معقول.
- WAF أو reverse proxy (nginx/traefik) لطبقة إضافية.

---

## 11) Audit Review Tooling (RECOMMENDED)

**المخرجات (خياران):**
- (a) سكريبتات تصدير ad-hoc من DB ⇒ تدقيق دوري بشري.
- (b) صفحة `/admin/audit` minimal تعرض/تفلتر الأحداث ⇒ يحتاج قرارًا
  للصلاحية (D-053+).

---

## 12) Deployment Hardening (MANDATORY)

**المخرجات:**
- HTTPS-only عبر reverse proxy + HSTS.
- CORS تشديد (origin محدد فقط للـ frontend).
- Spring Security headers (CSP, X-Frame-Options, etc.).
- Profile `production` منفصل ⇒ يعطل bootstrap admin، يعطل dev seed،
  يضبط مستويات log المناسبة.
- Container: image مُصلَّب، non-root، read-only filesystem.
- Health checks + readiness/liveness.
- Logging مركزي + alerting على ERROR.
- Monitoring (metrics + traces).

---

## 13) Cleanup قبل الإنتاج (MANDATORY)

- [ ] حذف `V20__dev_seed_test_users.sql` من `db/migration`.
- [ ] تعطيل `BootstrapAdminRunner` في profile الإنتاج (D-018).
- [ ] إزالة أي حسابات تجريبية من DB قبل النشر.
- [ ] تغيير كل كلمات المرور الأولية.
- [ ] مراجعة `application.yml` لإزالة dev defaults.

---

## 14) القرارات المطلوبة (D-046+)

| رقم مقترح | السياق | يخص |
|----------|------|-----|
| **D-046** | شكل `GET /users` + قواعد الصلاحية | Mini-phase A |
| **D-047** | آلية كلمة المرور الأولى للمستخدم الجديد | Mini-phase B |
| **D-048** | BRANCH_HEAD لا يمنح/يسحب BRANCH_HEAD | Mini-phase B |
| **D-049** | استراتيجية httpOnly cookies + CSRF | §3 |
| **D-050** | (اختياري) أي تغيير في `storage_key` أو حد 50MB | §4 |
| **D-051** | سياسة AV: فشل = 422 + quarantine | §5 |
| **D-052** | قنوات الإشعارات لكل نوع + تفضيلات المستخدم | §6 |
| **D-053** | (اختياري) صلاحية صفحة Audit الإدارية | §11 |

ترقيم D-046+ الفعلي يتقرر عند التنفيذ — هذه أرقام مقترحة للتسلسل
المنطقي.

---

## 15) ترتيب التنفيذ الموصى به (سلسلة منطقية)

1. **Mini-phase A** (assign-lawyer) ⇒ D-046.
2. **UI sub-phase A** (`AssignLawyerSection` + استبدال أسماء).
3. **Mini-phase B** (user admin) ⇒ D-047, D-048.
4. **UI sub-phase B** (`/admin/users`).
5. **SMS provider + rate limiting** ⇒ §7 + §10.
6. **httpOnly cookies** ⇒ D-049 + §3.
7. **Object storage + AV** ⇒ §4 + §5 + D-051.
8. **Scheduler + قنوات إشعار** ⇒ §6 + D-052.
9. **Backup/Restore + Secrets** ⇒ §8 + §9.
10. **Deployment hardening + Cleanup** ⇒ §12 + §13.
11. **Audit review tooling** (اختياري) ⇒ §11 + D-053.

تقدير إجمالي مرن: **6–10 أسابيع** عمل مكثف، يعتمد على فريق ops متاح.

---

## 16) معايير الإغلاق النهائي «production-ready»

✅ يمكن ادعاء production-readiness **فقط** عندما:
- [ ] كل البنود MANDATORY أعلاه مُغلقة بـ PR + قرار D-XXX موثَّق.
- [ ] اختبار restore فعلي تم وثُبِّت.
- [ ] penetration test أو security review مرّ.
- [ ] runbook التشغيل مكتوب (deploy, rollback, incident response).
- [ ] الفريق التشغيلي مُدرَّب على الأدوات.
- [ ] SLO مكتوب + monitoring + alerting يعمل.
- [ ] data classification وretention policy موثَّقتان.

أي بند غير محقَّق ⇒ النظام **ليس production-ready**.

