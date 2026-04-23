# FINAL_DEMO_CHECKLIST
## قائمة جاهزية العرض (Demo Readiness)

> هذه القائمة تشغيلية. كل خطوة قابلة للتنفيذ كما هي. تعتمد على
> `V20..V22` dev seed migrations المتاحة في `db/migration`.
>
> **V22 (2026-04-18):** أُضيفت court access للمحامين + 4 demo cases مترابطة
> + execution file + reminders + notifications + attachments metadata.
> **BUG-003 مُغلق** — assign-lawyer يعمل الآن بدون تدخل DBA.
>
> **هذا الملف للديمو الداخلي/أمام أصحاب القرار. ليس pilot ولا production.**

---

## 1) المتطلبات المسبقة

| المكوّن | الإصدار | ملاحظات |
|--------|---------|---------|
| Java | 17+ | لازم لـ Spring Boot |
| Maven | 3.9+ | bundled wrapper متاح إن لزم |
| PostgreSQL | 14+ | DB واحدة |
| Node.js | 20+ | لـ frontend |
| npm | 10+ | — |

تأكد قبل البدء:
- DB فارغة جديدة (للـ demo نظيف)، أو DB موجودة بالـ migrations المطبَّقة.
- مجلد `attachments-data` قابل للكتابة (يُنشأ تلقائيًا).

---

## 2) تشغيل الـ Backend

```powershell
cd "C:\Users\kadri\Desktop\برنامج محامي\backend"

# 1) ضبط متغيرات DB في application.yml أو عبر env vars
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/sla_demo"
$env:SPRING_DATASOURCE_USERNAME = "postgres"
$env:SPRING_DATASOURCE_PASSWORD = "postgres"

# 2) Build (آخر بناء موثَّق ناجح: BUILD SUCCESS في Phase 7)
mvn clean package -DskipTests

# 3) Run
java -jar target\state-litigation-backend.jar
```

عند أول إقلاع:
1. Flyway يطبّق V1..V19 (production migrations).
2. Flyway يطبّق `V20__dev_seed_test_users.sql` (5 مستخدمين تجريبيين).
   - ⚠️ إن لم يكن `admin` موجودًا بعد، V20 يُسجِّل NOTICE ويتخطى. أعد
     تشغيل الـ backend مرة ثانية بعد bootstrap admin ⇒ V20 يُتمم الـ seed.
3. `BootstrapAdminRunner` يُنشئ `admin / ChangeMe!2026` (D-018).

---

## 3) تشغيل الـ Frontend

```powershell
cd "C:\Users\kadri\Desktop\برنامج محامي\frontend"

# Install
npm install

# Dev server (موصى به للـ demo)
npm run dev
# Vite يفتح على http://localhost:5173 افتراضيًا
```

تأكد أن `VITE_API_BASE_URL` (أو الـ default المضبوط) يشير إلى
`http://localhost:8080/api/v1`.

---

## 4) حسابات الديمو (من V20 + V21 dev seed)

كلهم بكلمة مرور: `ChangeMe!2026`

| Username | الدور | الفرع/القسم | لماذا تستخدمه |
|----------|------|-------------|---------------|
| `admin` | CENTRAL_SUPERVISOR | — | bootstrap + قراءة شاملة |
| `head_dam` | BRANCH_HEAD | DAMASCUS | عرض scope مستوى الفرع |
| `section_fi_dam` | SECTION_HEAD | DAMASCUS / FIRST_INSTANCE | إنشاء/تعديل/ترقية/إسناد الدعاوى |
| `clerk_fi_dam` | ADMIN_CLERK | DAMASCUS / FIRST_INSTANCE | بكامل التفويضات (D-004) — يشمل ASSIGN_LAWYER |
| `clerk2_fi_dam` *(V21)* | ADMIN_CLERK | DAMASCUS / FIRST_INSTANCE | بكل التفويضات **عدا ASSIGN_LAWYER** — يبرهن أن قسم «إسناد محامٍ» مخفي عنه (D-046) |
| `lawyer_fi_dam` | STATE_LAWYER | DAMASCUS / FIRST_INSTANCE | يُرحِّل الجلسات، يفصل، يرفع مرفقات |
| `lawyer2_fi_dam` *(V21)* | STATE_LAWYER | DAMASCUS / FIRST_INSTANCE | محامٍ بديل لتجربة dropdown إسناد فيه أكثر من خيار |
| `lawyer_inactive_fi` *(V21)* | STATE_LAWYER (user.active=false) | DAMASCUS / FIRST_INSTANCE | يبرهن أن `activeOnly=true` يستبعد المعطّل (D-046) |
| `lawyer_app_dam` *(V21)* | STATE_LAWYER | DAMASCUS / **APPEAL** | يبرهن أن `departmentId` filter يستبعد محامي قسم آخر (D-046) |
| `viewer` | READ_ONLY_SUPERVISOR | — (لا عضوية) | عرض read-only شامل |

### 4b) قضايا الديمو المسبقة (V22)

| القضية | الرقم | الحالة | الاستخدام |
|--------|------|--------|----------|
| DEMO-FRESH-001 | وزارة المالية ضد شركة الأمل | `NEW` — لم تُسند | اختبار assign-lawyer → rollover → finalize |
| DEMO-ASSIGNED-002 | وزارة الصحة ضد أحمد الخطيب | `ACTIVE` — مُسندة لـ lawyer_fi_dam | rollover → finalize → resolved register |
| DEMO-FINAL-003 | وزارة التربية ضد محمد العلي | `ACTIVE/FINALIZED` | promote-to-appeal |
| DEMO-EXEC-004 | وزارة الدفاع ضد سامر الشامي | `IN_EXECUTION` | عرض execution files + إضافة خطوات |

---

## 5) سيناريوهات الديمو الموصى بها

### السيناريو A — رحلة قيد دعوى ⇒ جلسة ⇒ فصل ⇒ سجل (10 دقائق)
1. دخول كـ `section_fi_dam`.
2. `+ إنشاء دعوى` (Phase 11): إدخال البيانات، اختيار محكمة من
   dropdown مفلتر، حفظ. لاحظ: «سبب التأجيل الأول» نص حر (D-020).
3. فتح الدعوى، تعديل البيانات الأساسية عبر modal (Phase 11).
4. **(Mini-Phase A — D-046):** في القسم الجديد «إسناد محامٍ» داخل
   `CaseDetailPage`، اختر `lawyer_fi_dam` (أو `lawyer2_fi_dam`) من القائمة
   المنسدلة المُفلترة، ثم «تأكيد الإسناد». لاحظ أن حقل «المالك الحالي» وعمود
   «المحامي المُسنَد» في جدول المراحل أصبحا يعرضان الاسم بدل `#userId`.
   ⚠️ لم يعد هناك حاجة لأي SQL يدوي لإسناد محامٍ.
5. خروج، دخول كـ `lawyer_fi_dam`.
6. فتح الدعوى ⇒ المرحلة ⇒ ترحيل جلسة، ثم فصل (decisionType = `FOR_ENTITY`).
7. خروج، دخول كـ `section_fi_dam`.
8. فتح `سجل الفصل` ⇒ الدعوى ظاهرة في شهر الفصل.

### السيناريو B — استئناف ⇒ تنفيذ (5 دقائق)
1. على الدعوى نفسها كـ `section_fi_dam`: «ترقية إلى الاستئناف» ⇒ مرحلة جديدة
   (D-002).
2. أعد إسناد المحامي للمرحلة الجديدة من قسم «إسناد محامٍ» (Mini-Phase A —
   D-046)، رحّل + فصل المرحلة الجديدة.
3. كـ `section_fi_dam`: «ترقية إلى التنفيذ» ⇒ ينشأ `ExecutionFile` (D-003).
4. فتح ملف التنفيذ ⇒ إضافة خطوة تنفيذ (append-only).

### السيناريو C — مرفقات + تذكيرات + إشعارات (5 دقائق)
1. كـ `lawyer_fi_dam` أو `section_fi_dam`: ارفع مرفقًا على المرحلة
   (`AttachmentsSection`). نزّله — يفتح عبر blob authenticated.
2. كـ أي مستخدم في scope الدعوى: أنشئ تذكيرًا، ثم علّمه `DONE`. لاحظ
   D-037 (شخصي).
3. صفحة `/notifications` تعرض `CASE_REGISTERED` و `LAWYER_ASSIGNED` (D-038).

### السيناريو D — المعرفة (Phase 7) (3 دقائق)
1. `/legal-library` بحث + فتح صفحة تفاصيل عنصر.
2. `/public-entities` نفس الفكرة.
3. `/circulars` فلترة بـ `source_type` (MoJ / SLA — D-040).

### السيناريو E — Forgot/Reset password (3 دقائق)
1. خروج. على `/login`: «نسيت كلمة المرور؟».
2. إدخال `mobileNumber` لمستخدم تجريبي ⇒ صفحة تأكيد محايدة (D-013).
3. **قبل الديمو** (لأن لا SMS provider): اقرأ OTP من logs الـ backend.
4. أدخل OTP + كلمة مرور جديدة ⇒ إعادة توجيه `/login` مع شريط نجاح.

---

## 6) ما يجب تجنّبه أثناء الديمو

| البند | السبب |
|------|------|
| **عدم فتح صفحة `/admin/users`** | لا توجد |
| **عدم محاولة حذف/تعديل مرفق** | غير موجود (D-039) |
| **عدم محاولة re-open تذكير DONE/CANCELLED** | مرفوض (D-037) |
| **عدم إرسال POST يدوي لإشعار** | غير موجود (D-038) |
| **عدم فتح dropdown أسباب التأجيل** | غير موجود — حقل نص حر (D-020) |
| **عدم استخدام مزود SMS فعلي** | غير مدمج — اعتمد console logs |
| **عدم التطرق لـ realtime/WebSocket** | غير موجود (D-039) |

---

## 7) Fallback Plan (إن ظهر gap أمام الجمهور)

| الموقف | الـ Fallback |
|--------|-------------|
| سؤال «أين شاشة إدارة المستخدمين؟» | اشرح أنها مخطَّطة في mini-phase B الموثَّق (`BACKEND_GAP_PHASE11_USER_ADMIN.md`) — لم تُبنَ عمدًا في Phase 11 لتجنّب أوهام |
| سؤال «لماذا سبب التأجيل نص حر؟» | اشرح D-020: العمود في DB حر VARCHAR + dropdown ينتظر mini-phase صغير |
| فشل صفحة `/notifications` بدون بيانات | أنشئ دعوى جديدة فورًا ⇒ إشعار `CASE_REGISTERED` يولَّد |
| OTP لم يصل | افتح terminal الـ backend واقرأ السطر `OTP for ...` |
| تنزيل مرفق فشل بسبب 401 | تحقق من بقاء الـ session — أعد دخول |

---

## 8) قبل/بعد الديمو

**قبل:**
- [ ] DB نظيفة + backend يعمل + V20 و **V21** طُبِّقا (موجود `head_dam`,
  `section_fi_dam`, `clerk_fi_dam`, `clerk2_fi_dam`, `lawyer_fi_dam`,
  `lawyer2_fi_dam`, `lawyer_inactive_fi`, `lawyer_app_dam`, `viewer`).
- [ ] Frontend يعمل على `localhost:5173`.
- [ ] OTP terminal مفتوح (لـ السيناريو E).
- [ ] (اختياري) أنشئ دعوى نموذجية مسبقًا لتقصير وقت السيناريو A —
  لم يعد الإسناد يحتاج SQL يدوي بفضل Mini-Phase A.

**بعد:**
- [ ] لا تترك `BootstrapAdminRunner` مفعَّلًا في أي بيئة عامة.
- [ ] لا تنشر هذا الـ build كـ pilot/production دون اتباع
  `FINAL_PILOT_GAP_LIST.md` أو `FINAL_PRODUCTION_READINESS_PLAN.md`.

---

## 9) ملاحظة على البناء/الاختبار

- **Backend:** آخر `mvn clean package -DskipTests` موثَّق ⇒ BUILD SUCCESS
  (في Phase 7).
- **Frontend Phase 10:** `npm run build` + `npm test -- --run` ⇒ 17/17 PASS.
- **Frontend Phase 11:** `tsc` نظيف على 13 ملف (`get_errors`)؛ تنفيذ
  `npm test` لم يُمكن في PowerShell عبر مسار عربي. يُنصح إعادة تشغيل
  المجموعة من بيئة CI أو من مسار لاتيني قبل الديمو الرسمي.

أمر اختبار يدوي قبل الديمو:
```powershell
cd "C:\Users\kadri\Desktop\برنامج محامي\frontend"
npm run build   # يجب أن ينجح
npm test -- --run   # يجب أن تنجح كل الاختبارات (Phase 10 + Phase 11 مضافة)
```







