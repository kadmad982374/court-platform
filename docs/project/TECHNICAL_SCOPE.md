# TECHNICAL_SCOPE
## النطاق التقني للنظام

> مبني على §3–§13 من الوثيقة التقنية. تجميد التكنولوجيا والبنية يحصل في هذه الوثيقة.

---

## 1) Tech Stack المستهدف

### Backend
- **Java 21**
- **Spring Boot 3** (Web, Data JPA, Security, Validation)
- **PostgreSQL** كقاعدة بيانات وحيدة
- **Flyway** لإدارة الـ migrations
- **Springdoc OpenAPI** لتوثيق الـ APIs
- **Lombok** لتقليل boilerplate
- **Testcontainers** للاختبارات التكاملية مع PostgreSQL حقيقي
- JUnit 5، AssertJ، Mockito للاختبارات

### Frontend
- **React 18 + TypeScript**
- **Vite** كأداة بناء
- **React Router** للتنقل
- **TanStack Query** لإدارة بيانات الخادم
- **Axios** لاستدعاء الـ APIs
- **React Hook Form + Zod** للنماذج والتحقق
- **Tailwind CSS + shadcn/ui** لطبقة الواجهة

### البنية التحتية للتشغيل
- Docker لتشغيل PostgreSQL محليًا.
- ملفات `docker-compose.yml` وملفات بيئة سيُجهَّزان في المرحلة 1 عند الحاجة.
- نشر الإنتاج خارج نطاق المرحلة الحالية.

---

## 2) نمط المعمارية

**Modular Monolith** صارم:
- وحدة واحدة لكل مجال (انظر `DOMAIN_BOUNDARIES.md`).
- الفصل بين الطبقات داخل كل وحدة:
  1. **Domain**: كيانات وقواعد عمل.
  2. **Application**: خدمات تطبيق، use cases، تنسيق، تطبيق الصلاحيات.
  3. **Infrastructure**: JPA repositories، تنفيذات منافذ خارجية.
  4. **API**: Controllers، DTOs، Mappers.
- التواصل بين الوحدات عبر **Application Services** فقط (لا يجوز اختراق Domain أو Repository من وحدة لأخرى).
- استخدام Events داخلية (Spring Events) للأحداث المتقاطعة (مثلًا: `CaseRegisteredEvent` يلتقطه `notifications` و`audit`).

---

## 3) حدود Backend / Frontend

| العنصر | Backend | Frontend |
|---|---|---|
| مصدر الحقيقة لقواعد العمل | نعم | لا |
| تطبيق الصلاحيات | نعم (إلزامي) | تخفي/إظهار فقط |
| التحقق من المدخلات | نعم (Bean Validation) | إضافي بالـ Zod لتجربة المستخدم |
| الترقيم/الفلترة | نعم | يُمرَّر فقط |
| الـ State الدائم | قاعدة البيانات | TanStack Query cache |
| الـ Audit | نعم | لا |
| توليد التقارير | نعم | عرض فقط |

> **مبدأ صارم:** أي قاعدة عمل غير مفروضة في الخادم تُعتبر **غير موجودة**.

---

## 4) وحدات Backend

17 وحدة (انظر `DOMAIN_BOUNDARIES.md` لمسؤولياتها):
identity, organization, access-control, litigation-registration, litigation-progression, decision-finalization, resolved-register, stage-transition, execution, attachments, reminders, notifications, legal-library, public-entity-directory, circulars, reporting, audit.

كل وحدة ستُمثَّل لاحقًا كحزمة (package) منفصلة:
```
backend/src/main/java/.../<module>/
  domain/
  application/
  infrastructure/
  api/
```

---

## 5) وحدات Frontend
- `auth` (تسجيل الدخول/الحساب/استعادة كلمة المرور)
- `app-shell` (الهيكل العام، التنقل حسب الدور)
- `cases-registration`
- `cases-list`
- `case-details`
- `today-hearings`
- `resolved-register`
- `execution-files`
- `attachments`
- `reminders`
- `notifications`
- `legal-library`
- `public-entity-directory`
- `circulars`
- `reports`
- `shared` (مكونات، hooks، API client، ثيم RTL)

---

## 6) مبادئ الأمن والتدقيق

### الأمن
- المصادقة بـ JWT قصير العمر + Refresh Token (التفاصيل تُحدَّد في المرحلة 1).
- كلمات المرور بـ BCrypt.
- HTTPS إلزامي في الإنتاج.
- جميع الـ endpoints محمية افتراضيًا، يُستثنى فقط `/auth/*` العامة.
- Rate limiting على endpoints المصادقة وOTP.
- Input validation عبر Bean Validation + قواعد إضافية في الـ Application layer.
- منع XSS/CSRF وفق ممارسات Spring Security وReact.
- السرّيات في متغيرات بيئة، لا في المستودع.

### الصلاحيات
- تُفرض في طبقة Application (استخدام `@PreAuthorize` + Authorization Service مخصص لقواعد النطاق).
- قاعدة ملكية الدعوى وحدود الفرع/القسم تُتحقق على كل قراءة وتعديل.

### التدقيق
- وحدة `audit` تستقبل أحداثًا داخلية وتسجلها.
- كل سجل: `actor_user_id`, `action_code`, `entity_type`, `entity_id`, `timestamp`, `branch_scope`, `details_json`.
- لا تعديل أو حذف لسجلات الـ Audit.

---

## 7) مبادئ الـ API

- **Base path:** `/api/v1`.
- **REST** مع موارد واضحة، أفعال HTTP قياسية، JSON.
- **DTOs** صريحة للـ request/response (لا Entities مباشرة).
- **Pagination**: `page`, `size`, `sort` على القوائم.
- **Errors**: استجابة موحدة `{ code, message, details? , traceId }` مع رموز HTTP صحيحة (400/401/403/404/409/422/500).
- **OpenAPI** مولد تلقائيًا، يُستخدم لتوليد types في الـ Frontend عند الحاجة.
- **Idempotency**: عند الإنشاء الذي يحتمل التكرار يُدعم `Idempotency-Key` (مثل ترحيل الجلسة).
- **Versioning**: `/v1` ثابت في الإصدار الأول.
- **Localization**: الرسائل الموجهة للمستخدم بالعربية؛ رموز الأخطاء بالإنجليزية.

---

## 8) مبادئ State Handling

### Backend
- لا state داخل الذاكرة بين الطلبات (stateless).
- الـ JPA transactions تُدار في طبقة الـ Application.
- العمليات المتعددة الخطوات تُغلَّف بمعاملة واحدة.
- الأحداث الداخلية تُنشر بعد commit (TransactionalEventListener) لتجنب آثار جانبية على معاملات فاشلة.

### Frontend
- **TanStack Query** هو المصدر لبيانات الخادم (cache + invalidation).
- **React Hook Form** لحالة النماذج.
- حالة UI خفيفة عبر React state؛ لا داعي لمتجر عام كبير في الإصدار الأول.
- Routing عبر React Router؛ guards حسب الدور تستخدم بيانات `/users/me`.
- التنقل بعد العمليات يستند إلى استجابة الخادم لا إلى افتراضات client-side.

---

## 9) معايير الجودة الإلزامية
- اختبارات وحدة لكل Service رئيسي.
- اختبارات تكاملية بـ Testcontainers لكل تدفق رئيسي (قيد دعوى، ترحيل، فصل، انتقال، تنفيذ، رفع مرفق، صلاحية).
- تغطية الفروع الرئيسية لقواعد الصلاحيات إلزامية.
- مراجعة كل PR للتحقق من عدم اختراق حدود الوحدات.

