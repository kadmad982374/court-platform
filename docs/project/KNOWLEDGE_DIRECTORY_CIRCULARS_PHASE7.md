# KNOWLEDGE DIRECTORY & CIRCULARS — Phase 7

> Phase 7 من خطة التنفيذ. يقدّم ثلاث وحدات قراءة (Read-oriented):
>  1. المكتبة القانونية (`legal-library`).
>  2. دليل الجهات العامة (`public-entity-directory`).
>  3. التعاميم/القرارات (`circulars`).
>
> الهدف: قراءة وتصنيف وبحث وعرض منظم. **ليست CMS** ولا workflow نشر.

---

## 1) النطاق

داخل النطاق:
- كيانات JPA بسيطة، migrations مع seed مبدئي، APIs قراءة فقط، بحث وتصفية ضمن JPA Specifications (D-041).
- صلاحيات: أي مستخدم مصادق عليه (D-042) — لا تقسيم scope إضافي على هذه الوحدات.

خارج النطاق (Phase 7):
- Frontend.
- write/admin endpoints (إنشاء/تعديل/حذف).
- Versioning أو approval workflow.
- Full-text search engine (Elastic/PG tsvector).
- Notifications/scheduler.
- ربط هذه الوحدات بمنطق الدعاوى أو التذكيرات أو الإشعارات.

---

## 2) القرارات الجديدة الموثَّقة (D-040..D-042)
انظر `PROJECT_ASSUMPTIONS_AND_DECISIONS.md` — قرارات D-040, D-041, D-042.

---

## 3) المخطّط (Schema)

### 3.1 `legal_categories` (V17)
هرمي عبر `parent_id` ذاتي المرجع. مفتاح فريد على `code`. `sort_order` للعرض.

### 3.2 `legal_library_items` (V17)
`title`, `summary`, `body_text`, `keywords`, `source_reference`, `published_at`, `is_active`, تواريخ.
فهارس بسيطة على `category_id`, `is_active`, `published_at`, و `LOWER(title)` لمساعدة ILIKE.

### 3.3 `public_entity_categories` (V18)
نفس البنية الهرمية مع `code` فريد.

### 3.4 `public_entity_items` (V18)
`name_ar`, `short_description`, `details_text`, `keywords`, `reference_code` (فريد، nullable).

### 3.5 `circulars` (V19)
`source_type` (CHECK في DB)، `title`, `summary`, `body_text`, `issue_date` (مطلوب)، `reference_number`, `keywords`, `is_active`.

---

## 4) الكيانات (Java)

| Module | Entities |
|---|---|
| `legallibrary` | `LegalCategory`, `LegalLibraryItem` |
| `publicentitydirectory` | `PublicEntityCategory`, `PublicEntityItem` |
| `circulars` | `Circular` (+ enum `CircularSourceType`) |

كل ذلك ضمن package جذري `sy.gov.sla.<module>` بالطبقات المعتادة `domain / application / infrastructure / api`.

`PageResponse<T>` المشترك أُضيف تحت `sy.gov.sla.common.api.PageResponse` (لاستخدامات Phase 7+) — لم يُمَس `litigationregistration.api.PageResponse` التاريخي.

---

## 5) APIs (Phase 7)

### 5.1 المكتبة القانونية
- `GET /api/v1/legal-library/categories?active={true|false}` → `List<LegalCategoryDto>`
- `GET /api/v1/legal-library/items?categoryId&q&active&page&size` → `PageResponse<LegalLibraryItemDto>`
- `GET /api/v1/legal-library/items/{id}` → `LegalLibraryItemDto`

### 5.2 دليل الجهات العامة
- `GET /api/v1/public-entities/categories?active={true|false}` → `List<PublicEntityCategoryDto>`
  > endpoint مساعد للفئات الهرمية — موثَّق صراحةً ضمن المسموح في Phase 7.
- `GET /api/v1/public-entities?categoryId&q&active&page&size` → `PageResponse<PublicEntityItemDto>`
- `GET /api/v1/public-entities/{id}` → `PublicEntityItemDto`

### 5.3 التعاميم
- `GET /api/v1/circulars?sourceType&q&issueDateFrom&issueDateTo&active&page&size` → `PageResponse<CircularDto>`
- `GET /api/v1/circulars/{id}` → `CircularDto`

ملاحظات:
- `page` افتراضي 0، `size` افتراضي 20، حد أقصى 100.
- `issueDateFrom` / `issueDateTo` بصيغة ISO `yyyy-MM-dd`. مدى مقلوب ⇒ `400 INVALID_DATE_RANGE`.
- ترتيب الافتراضي:
  - `legal-library/items` → DESC `published_at` ثم DESC `id`.
  - `public-entities` → ASC `id`.
  - `circulars` → DESC `issue_date` ثم DESC `id`.

---

## 6) استراتيجية البحث والتصفية (D-041)

استخدمنا **JPA Specifications** + ILIKE بسيط:
- `q` يُحوَّل إلى `%term%` (lowercased) ويُطابق على عدّة حقول نصية حسب الوحدة:
  - مكتبة: `title / summary / body_text / keywords`.
  - جهات: `name_ar / short_description / details_text / keywords`.
  - تعاميم: `title / summary / body_text / keywords / reference_number`.
- `categoryId` = مساواة على `category_id`.
- `active` (Boolean) اختياري — إن غاب لا يُفلتر.
- `sourceType` = enum مساواة.
- `issueDateFrom/To` = `>=` و`<=` على `issue_date`.

**سبب اختيار ILIKE الآن** بدل tsvector/GIN:
- البيانات صغيرة الحجم (Phase 7 seed قليل، نمو بطيء متوقع).
- عدم تعقيد الـ migration ولا اعتماد extensions PostgreSQL.
- قابل للترقية لاحقًا بقرار جديد D-043+ دون كسر الـ APIs.

---

## 7) Seed Data (V17/V18/V19)

- **مكتبة قانونية**: 7 فئات + 7 عناصر (واحد لكل فئة).
- **جهات عامة**: فئتان (`MINISTRIES`, `OTHER_AUTHORITIES`) + 9 وزارات.
- **تعاميم**: 4 تعاميم (2 من وزارة العدل + 2 من إدارة قضايا الدولة).

بيانات seed تُدار حصريًا عبر Flyway (لا واجهة عامة لإضافتها)، تمشّيًا مع نهج المراحل السابقة.

---

## 8) الصلاحيات (D-042)

كل APIs Phase 7 = **قراءة فقط لأي مستخدم مصادق عليه**.
لا تمييز بين الأدوار في هذه المرحلة (`SecurityUtils.currentUserOrThrow()` فقط، لا `AuthorizationContext` ولا `read-scope` كحال الدعاوى).
لا توجد write APIs نهائيًا في Phase 7.

تنبيه: أي إضافة لاحقة لإنشاء/تعديل (مثلاً CRUD إداري لرئاسة الإدارة) = قرار جديد D-043+.

---

## 9) Domain Boundaries
- لا تربط هذه الوحدات أي كيان من `litigationregistration` أو `execution` أو غيرها.
- لا تنشر/تستهلك events.
- لا تستخدم `AuthorizationService` (لا حاجة — D-042).
- لا تربط بـ `attachments` أو `reminders` أو `notifications`.

(محترم D-023.)

---

## 10) الاختبارات

### Unit
- `CircularSourceTypeUnitTest` — تحقق من القيم المحصورة بـ `MINISTRY_OF_JUSTICE` و`STATE_LITIGATION_ADMINISTRATION`.
- `LegalLibraryDomainUnitTest` — حقول `LegalCategory`/`LegalLibraryItem` الأساسية.
- `PublicEntityDirectoryDomainUnitTest` — حقول `PublicEntityCategory`/`PublicEntityItem` الأساسية.

### Integration (Testcontainers)
`KnowledgeDirectoryCircularsIT` يغطي السيناريوهات 1..17 المطلوبة في برومبت Phase 7:
1. قراءة categories مكتبة ✅
2. list items بـ pagination ✅
3. filter by category ✅
4. text search `q` ✅
5. get by id ✅
6. anonymous → 401 ✅
7. list public-entities ✅
8. filter بـ category ✅
9. text search `q` ✅
10. get by id ✅
11. anonymous → 401 ✅
12. list circulars ✅
13. filter بـ sourceType ✅
14. filter بـ issue date (+ مدى مقلوب → 400) ✅
15. text search ✅
16. get by id ✅
17. anonymous → 401 ✅

تُتطلَّب Docker daemon لتشغيل Testcontainers (مثل ITs المراحل 1..6).

---

## 11) Build & Test
- `mvn -DskipTests clean package` → **BUILD SUCCESS** (jar نهائي).
- `mvn -Dtest='*UnitTest' test` → جميع الـ UnitTests خضراء بما فيها الجديدة Phase 7 (5/5 جديدة).
- ITs Phase 7 جاهزة للتشغيل عند توفّر Docker.

---

## 12) ما لم يُنفَّذ (مقصود)
- لا CRUD إداري.
- لا upload لمرفقات داخل المكتبة/التعاميم (D-039 + D-042).
- لا ترتيب ديناميكي عبر API.
- لا قنوات إشعار خارجية ولا scheduler.
- لا تكامل بحث متقدم (full-text/synonyms/vectors).

أي توسعة لأي بند = D-043+.

