# FINAL_PRODUCTION_BLOCKERS
## العوائق الحاسمة قبل ادعاء production-readiness

> هذا ملف صريح. لكل عائق: **شدّته**، **لماذا يهم**، **أي mini-phase يصلحه**،
> و**أي تصنيف جاهزية يمنع** (demo / pilot / production).

شدة العائق:
- **CRITICAL** — يمنع production مطلقًا.
- **HIGH** — يمنع pilot واسع، أو يفرض إجراءات بشرية بديلة عُسرة.
- **MEDIUM** — تحسين قوي مطلوب قبل production لكن قابل للالتفاف.
- **LOW** — تحسين جودة/UX؛ غير مانع.

**لا يجوز تعليم أي bocker على أنه «مغلق» قبل وجود migration/PR/قرار D-046+
موثَّق.**

---

## 1) Gap — Assign Lawyer (لا UI لإسناد محامٍ) — ✅ **CLOSED بـ Mini-Phase A**

| الحقل | القيمة |
|------|--------|
| Severity | ~~HIGH~~ → **CLOSED** |
| Why it matters | (تاريخي) بدون اختيار محامٍ من قائمة، الإسناد يحتاج DBA يدخل `lawyerUserId` على endpoint مباشرة، أو SQL يدوي. |
| Mini-phase | ✅ Backend mini-phase A — `BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md` نُفِّذت + UI sub-phase. قرار **D-046** مثبَّت. |
| يمنع | لا شيء — الإسناد يعمل من الواجهة لكل دور مخوَّل (SECTION_HEAD أو ADMIN_CLERK + ASSIGN_LAWYER). |

**ما تم تسليمه:**
- Backend: `GET /api/v1/users?branchId=&departmentId=&membershipType=STATE_LAWYER&activeOnly=true`
  (read-only، 12 IT يغطي السيناريوهات).
- Frontend: `AssignLawyerSection` + `lawyerLabel` لاستبدال `#userId` بأسماء
  في `CaseDetailPage` (حقل المالك + جدول المراحل).
- Migration `V21__dev_seed_assign_lawyer.sql` — مستخدمون تجريبيون لكل
  حالات التصفية والصلاحية.
- قرار D-046 — شكل الاستجابة + قواعد الصلاحية + حصر `membershipType` على
  STATE_LAWYER فقط في Mini-Phase A.

**الباقي خارج Mini-Phase A (لم يُلمَس):**
- توسعة `membershipType` لقيم أخرى = D-047+ في Mini-Phase B.
- استبدال `#userId` بأسماء داخل `StageDetailPage` و `ExecutionFileDetailPage`
  لم يُنفَّذ في هذه الجلسة (سيُربط بنفس endpoint عند تنفيذه؛ التغيير
  بصري بحت). موثَّق هنا كنقطة تحسين لاحقة لا تمنع pilot/production.

---

## 2) Gap — User / Role / Membership / Delegation Admin — ✅ **FULLY CLOSED (Backend Mini-Phase B + UI sub-phase B, 2026-04)**

| الحقل | القيمة |
|------|--------|
| Severity | ~~CRITICAL~~ → ✅ **CLOSED** (لم يَعُد blocker على أي مستوى). |
| Why it matters | (تاريخي) لا يمكن في الإنتاج إنشاء BRANCH_HEAD جديد أو محامٍ جديد أو منح/سحب تفويض دون SQL يدوي. **بعد Mini-Phase B + UI sub-phase B**: كل العمليات متاحة عبر الواجهة `/admin/users` و `/admin/users/:id` مع صلاحيات صارمة (D-047/D-048). لا يحتاج المسؤول إلى DBA ولا إلى curl/Postman. |
| Mini-phase | ✅ Backend mini-phase B — `BACKEND_GAP_PHASE11_USER_ADMIN.md` نُفِّذت (D-047, D-048). ✅ UI sub-phase B — `frontend/src/features/admin-users/` نُفِّذت بالكامل (22 unit test أخضر). |
| يمنع | ❌ لا يمنع شيئًا. ⚠️ production يبقى محجوبًا حتى §3..§15 (httpOnly cookies, object storage, SMS, AV, scheduler, backups, secrets, rate limiting, deployment hardening) — بنود مستقلة عن إدارة المستخدمين. |

**ما تم تسليمه في Mini-Phase B (backend فقط):**
- 12 endpoint إدارية تحت `/api/v1/users[/{id}/...]` تغطي users CRUD محدود
  + roles + memberships + delegated permissions + court access (انظر
  `BACKEND_GAP_PHASE11_USER_ADMIN.md` §«التنفيذ الفعلي»).
- صلاحيات صارمة: CENTRAL_SUPERVISOR لمعظمها؛ BRANCH_HEAD لفرعه فقط في
  المعضويات (مع حظر D-048 على نوع `BRANCH_HEAD`)؛ SECTION_HEAD لقسمه
  فقط في التفويضات وخدمة الـ court access.
- 22 IT جديدة في `UserAdminApiIT` تغطي المسارات والحدود السلبية.
- صفر migrations جديدة. صفر تغييرات على عقود Mini-Phase A أو على
  مسارات `AccessControlController` الـ bulk القائمة.
- قرارات D-047 + D-048 موثَّقتان في
  `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

**ما تم تسليمه إضافة على Mini-Phase B (UI sub-phase B):**
- `/admin/users` (`AdminUsersListPage`): قائمة + بحث + إنشاء +
  تفعيل/تعطيل.
- `/admin/users/:id` (`AdminUserDetailPage`): PATCH + 4 sections
  (`RolesSection`, `MembershipsSection`, `DelegationsSection`,
  `CourtAccessSection`).
- `CreateUserModal` يفرض D-047 (كلمة مرور أولية إلزامية + رفض
  السلسلة الحرفية `ChangeMe!2026`). `RolesSection` يفرض D-048
  (BRANCH_HEAD لا يمنح/يسحب `BRANCH_HEAD`).
- 22 unit test أخضر. صفر تعديل backend.

**الباقي (خارج إدارة المستخدمين — لم يُلمَس):**
- **D-049+ (مستقبلي)**: علم `must_change_password` على `User` + endpoint
  `change-password` لإجبار إعادة تعيين كلمة المرور عند أول دخول. غير مطلوب
  لـ Mini-Phase B وموثَّق صراحة كنقطة LOW متبقية (انظر §16 أدناه).

---

## 2-bis) Gap الجديد — Mini-Phase B caveat: لا «must change on first login»

| الحقل | القيمة |
|------|--------|
| Severity | **LOW** |
| Why it matters | الخادم لا يُجبر آليًا المستخدم الجديد على تغيير كلمة المرور الأولية بعد أول دخول. السياسة الحالية (D-047) تعتمد على الانضباط الإداري + مسار `forgot/reset` القائم. مقبول للـ pilot الداخلي وغير حرج، لكنه يبقى ضعفًا تحكميًا. |
| Mini-phase | قرار جديد D-049+ + Flyway migration (`must_change_password BOOLEAN`) + endpoint `POST /auth/change-password`. |
| يمنع | لا يمنع شيئًا على مستوى wide pilot. ⚠️ مرغوب قبل production لتقليل سطح هجمات «admin handed off the same temp password to many users». |

---

## 2-ter) IT cross-context flakiness عند تشغيل كل الـ ITs معًا

| الحقل | القيمة |
|------|--------|
| Severity | **LOW (CI hygiene)** |
| Why it matters | عند تشغيل `mvn '-Dtest=*IT' test`، 17 اختبار في `ExecutionApiIT` و `phase6.AttachmentsRemindersNotificationsIT` و `AuthApiIT` و `CasesApiIT` يفشل بسبب تداخل سياق Spring المشترك (نفس DB seed بين tests). كل واحد من هذه الـ ITs ينجح بمعزله. غير مرتبط بـ Mini-Phase B (تأكَّد بإعادة التشغيل قبل/بعد). |
| Mini-phase | تنظيف فيلق الـ Test data: `@Transactional` rollback أو `@DirtiesContext` أو ResetDb hook. لا قرار جديد لازم. |
| يمنع | لا يمنع شيئًا. CI يجب أن يشغّل كل IT في عملية مستقلة (`mvn -Dtest=…`) أو يعتمد maven-failsafe-plugin. |

---

## 3) Gap — Postponement Reasons HTTP Lookup

| الحقل | القيمة |
|------|--------|
| Severity | **LOW** |
| Why it matters | `CreateCasePage` تستخدم نص حر بدلًا من dropdown. مقبول حسب D-020 (DB نفسها VARCHAR)، لكن UX دون المستوى. لا تأثير على بيانات/صلاحيات. |
| Mini-phase | Backend mini-phase صغير جدًا (ساعات) — `GET /api/v1/postponement-reasons` (مصادَق، read-only). |
| يمنع | لا يمنع شيئًا. تحسين UX فقط. |

**اللازم:**
- Backend: `GET /postponement-reasons` يُعيد `[{code, labelAr, active, sortOrder}]`.
- Frontend: استبدال `<textarea>` بـ `<select>` مع إبقاء fallback نص حر للحالات النادرة.

---

## 4) Token Storage = `localStorage` (D-044)

| الحقل | القيمة |
|------|--------|
| Severity | **MEDIUM** |
| Why it matters | `localStorage` معرَّض لـ XSS. مقبول للديمو وbpilot محدود؛ غير مقبول لنشر إنتاج عام مع مستخدمين خارج الشبكة الموثوقة. |
| Mini-phase | قرار جديد D-046+ يقرر التحول إلى httpOnly cookies + إعادة تنفيذ `tokenStorage` Port + تعديل `http` interceptor + CSRF protection. |
| يمنع | ❌ production عام. لا يمنع demo/pilot داخلي. |

**اللازم:**
- قرار D-046+ (طريقة التخزين، CSRF strategy، SameSite policy).
- Backend: تعديل `/auth/login` و `/refresh-token` لإصدار/قراءة cookies.
- Frontend: تعطيل قراءة/كتابة التوكن من JS — الـ Port يصبح فارغًا فعليًا.

---

## 5) Local Filesystem للمرفقات (D-035)

| الحقل | القيمة |
|------|--------|
| Severity | **HIGH** |
| Why it matters | لا backup/replication، لا توافق مع multiple instances، لا anti-virus scanning. مقبول للديمو/pilot على آلة واحدة فقط. |
| Mini-phase | استبدال adapter بـ S3/MinIO (الـ Port `AttachmentStoragePort` معدٌّ مسبقًا). يحتاج: bucket policy، KMS keys، AV scanning hook (مثل ClamAV)، lifecycle rules. لا حاجة لقرار جديد إذا التزمنا بنفس الـ Port. |
| يمنع | ❌ production. ⚠️ pilot واسع. |

**اللازم:**
- Backend: `S3AttachmentStorage` adapter + قرار جديد إن غُيِّر شكل `storage_key` أو الحد 50MB.
- Ops: Bucket، lifecycle، AV pipeline.

---

## 6) لا قناة SMS فعلية لـ OTP (D-013)

| الحقل | القيمة |
|------|--------|
| Severity | **CRITICAL لـ production مفتوح، LOW لـ pilot داخلي** |
| Why it matters | OTP يطبع في console فقط. مستخدم خارجي لن يستلم رمز إعادة التعيين. |
| Mini-phase | تنفيذ `SmsSenderPort` بمزود فعلي (مثل provider محلي). إضافة rate limiting على `/auth/forgot-password`. |
| يمنع | ❌ production عام (خاصة forgot-password flow). pilot داخلي يُتجاوز بإعطاء OTP يدويًا من logs. |

**اللازم:**
- Backend: SmsSenderPort implementation + secrets للـ provider.
- Ops: حساب SMS provider + monitoring فشل الإرسال.

---

## 7) لا scheduler للتذكيرات / لا قنوات إشعار خارجية (D-039)

| الحقل | القيمة |
|------|--------|
| Severity | **MEDIUM** |
| Why it matters | التذكيرات لا تذكِّر فعليًا — تُقرأ فقط حين يفتح المستخدم الصفحة. لا email/SMS/push عند `CASE_REGISTERED` أو `LAWYER_ASSIGNED`. |
| Mini-phase | إضافة scheduler (Spring `@Scheduled`) لتحويل reminders due إلى notifications + تنفيذ قنوات email/SMS عبر Ports. يحتاج قرارًا جديدًا D-046+ يحدد القنوات. |
| يمنع | ❌ production (وعد منتجي بأن التذكير يصل). pilot داخلي مقبول مع إخطار المستخدمين. |

---

## 8) `BootstrapAdminRunner` يجب تعطيله في الإنتاج (D-018)

| الحقل | القيمة |
|------|--------|
| Severity | **CRITICAL لـ production** |
| Why it matters | تركه مفعَّلًا = ممكن إعادة إنشاء `admin / ChangeMe!2026` عند أي حذف. |
| Mini-phase | إعداد ops فقط: `sla.bootstrap.central-supervisor.enabled=false` في profile الإنتاج. لا قرار جديد. |
| يمنع | ❌ production. |

---

## 9) `V20__dev_seed_test_users.sql` يجب حذفه قبل الإنتاج

| الحقل | القيمة |
|------|--------|
| Severity | **CRITICAL لـ production** |
| Why it matters | يُنشئ 5 مستخدمين تجريبيين بكلمة مرور `ChangeMe!2026`. ثغرة فورية. |
| Mini-phase | حذف الملف من `db/migration` قبل أي build إنتاج + خط أنابيب يمنع وجوده. |
| يمنع | ❌ production. مفيد جدًا للـ demo/pilot. |

---

## 10) لا backup / restore / DR موثَّق

| الحقل | القيمة |
|------|--------|
| Severity | **CRITICAL لـ production** |
| Why it matters | بلا backup للـ DB ولا لمجلد `attachments-data` = خسارة كاملة عند أي حادث. |
| Mini-phase | إعداد ops: `pg_dump` مجدول + نسخ مجلد المرفقات (أو S3 versioning عند التحول لـ §5). |
| يمنع | ❌ production. |

---

## 11) لا rate limiting على endpoints المصادقة

| الحقل | القيمة |
|------|--------|
| Severity | **HIGH لـ production** |
| Why it matters | `/auth/login` و `/auth/forgot-password` معرضان للـ brute-force وSMS abuse. |
| Mini-phase | filter rate-limiting (Bucket4j أو reverse proxy nginx). |
| يمنع | ❌ production. |

---

## 12) لا secrets management

| الحقل | القيمة |
|------|--------|
| Severity | **HIGH لـ production** |
| Why it matters | JWT secret، DB password، (مستقبلًا) SMS provider creds — حاليًا في `application.yml`. |
| Mini-phase | Vault / AWS Secrets Manager / k8s Secrets. لا قرار جديد. |
| يمنع | ❌ production. |

---

## 13) لا audit review tooling

| الحقل | القيمة |
|------|--------|
| Severity | **MEDIUM** |
| Why it matters | جداول الـ Audit موجودة، لكن لا UI/تقارير لمراجعتها بشكل دوري. |
| Mini-phase | (a) تصدير CSV من DB كـ ad-hoc، أو (b) صفحة `/admin/audit` minimal — يحتاج قرارًا للصلاحية. |
| يمنع | لا يمنع pilot. مطلوب لـ governance قبل production كامل. |

---

## 14) Lifecycle CLOSED للدعاوى/ملفات التنفيذ غير محرَّك تلقائيًا

| الحقل | القيمة |
|------|--------|
| Severity | **LOW** |
| Why it matters | الحالة تبقى ACTIVE/IN_EXECUTION حتى بعد آخر خطوة. لا تأثير وظيفي حالي. |
| Mini-phase | تعريف قاعدة الإغلاق (مثلاً ExecutionStep من نوع CLOSURE ⇒ يُغلق الملف) + قرار جديد. |
| يمنع | لا يمنع شيئًا حاليًا. |

---

## 15) لا deployment hardening موثَّق

| الحقل | القيمة |
|------|--------|
| Severity | **HIGH لـ production** |
| Why it matters | لا HTTPS-only، CORS مفتوح في dev profile، لا CSP، لا security headers، لا ip allowlist للإدارة. |
| Mini-phase | reverse proxy (nginx/traefik) + Spring Security headers + CORS تشديد + profile production منفصل. |
| يمنع | ❌ production. |

---

## ملخص بحسب التصنيف

| Blocker | يمنع demo | يمنع pilot محدود | يمنع pilot واسع | يمنع production |
|---------|:--:|:--:|:--:|:--:|
| 1. Assign-lawyer UI | ✅ **CLOSED بـ Mini-Phase A** | — | — | — |
| 2. User admin (backend) | ✅ **CLOSED بـ Mini-Phase B** | — | — | — |
| 2-bis. UI `/admin/users` minimal | ❌ | ⚠️ (إدارة عبر API client فقط) | ✅ | ✅ |
| 2-ter. must-change-on-first-login (D-049+) | ❌ | ❌ | ❌ | ⚠️ |
| 2-quater. IT cross-context flakiness | ❌ | ❌ | ❌ | ❌ |
| 3. Postponement lookup | ❌ | ❌ | ❌ | ❌ |
| 4. localStorage token | ❌ | ❌ | ❌ | ✅ |
| 5. Local filesystem attachments | ❌ | ❌ | ✅ | ✅ |
| 6. SMS OTP | ❌ | ⚠️ (workaround logs) | ✅ | ✅ |
| 7. Scheduler / channels | ❌ | ⚠️ | ✅ | ✅ |
| 8. Bootstrap admin | ❌ | ❌ | ❌ | ✅ |
| 9. V20 dev seed | ❌ | ❌ | ❌ | ✅ |
| 10. Backup/restore | ❌ | ❌ | ⚠️ | ✅ |
| 11. Rate limiting | ❌ | ❌ | ⚠️ | ✅ |
| 12. Secrets management | ❌ | ❌ | ⚠️ | ✅ |
| 13. Audit review tooling | ❌ | ❌ | ❌ | ⚠️ |
| 14. Lifecycle CLOSED | ❌ | ❌ | ❌ | ❌ |
| 15. Deployment hardening | ❌ | ❌ | ⚠️ | ✅ |

**الخلاصة:** الـ blockers مصنفة ومرتبطة بـ mini-phases محددة. ادعاء
production-readiness قبل إغلاق العناصر المُعلَّمة `✅` تحت عمود
«يمنع production» = ادعاء غير صحيح.



