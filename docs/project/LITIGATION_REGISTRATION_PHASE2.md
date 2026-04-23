# LITIGATION_REGISTRATION_PHASE2
## وحدة قيد الدعاوى — المرحلة 2

> هذه الوثيقة مرجع تقني سريع لما تم بناؤه فعليًا في Phase 2.
> المرجع الأعلى يبقى الوثيقتان العربيتان + قرارات `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

---

## 1) ما الذي بُني
وحدة backend جديدة باسم `litigationregistration` بحزمة `sy.gov.sla.litigationregistration`، بنفس بنية المرحلة 1:
```
sy.gov.sla.litigationregistration/
├── domain/
│   ├── LitigationCase, CaseStage
│   └── enums: StageType, StageStatus, LifecycleStatus, PublicEntityPosition
├── infrastructure/
│   ├── LitigationCaseRepository (+ JpaSpecificationExecutor)
│   ├── CaseStageRepository
│   └── CaseOwnershipAdapter (يُنفِّذ access.application.CaseOwnershipPort)
├── application/
│   ├── LitigationCaseService
│   ├── CaseRegisteredEvent
│   └── LawyerAssignedEvent
└── api/
    ├── CasesController
    └── DTOs: CreateCaseRequest, UpdateBasicDataRequest, AssignLawyerRequest,
              LitigationCaseDto, CaseStageDto, PageResponse
```

## 2) الكيانات المنفَّذة (2)
### `LitigationCase` — هوية الملف الأصلية
الحقول كاملة كما طلبتها المهمة وكما في التقنية §5.3:
`id, public_entity_name, public_entity_position, opponent_name, original_basis_number,
basis_year, original_registration_date, created_branch_id, created_department_id,
created_court_id, chamber_name, current_stage_id, current_owner_user_id,
lifecycle_status, created_by_user_id, created_at, updated_at`.

- `originalRegistrationDate` معلَّم `updatable = false` على JPA + لا حقل لتعديله في `UpdateBasicDataRequest` ⇒ **immutable** (D-006).
- `currentStageId` و `currentOwnerUserId` بدون FK (forward ref) لتجنب الاعتماد الدائري.

### `CaseStage` — المرحلة القضائية
`id, litigation_case_id, stage_type, branch_id, department_id, court_id, chamber_name,
stage_basis_number, stage_year, assigned_lawyer_user_id, stage_status, parent_stage_id,
is_read_only, started_at, ended_at` + الحقلين الانتقاليين (D-020):
`first_hearing_date`, `first_postponement_reason`.

`stage_type` يدعم `CONCILIATION` / `FIRST_INSTANCE` / `APPEAL`.
`parent_stage_id` و `is_read_only` موجودان كحقلين تمهيديين للمرحلة 4 (لا منطق ترقية الآن).

### Enums المُحدَثة في هذه المرحلة
- `StageType`: `CONCILIATION`, `FIRST_INSTANCE`, `APPEAL`.
- `LifecycleStatus`: `NEW`, `ACTIVE`, `IN_APPEAL`, `IN_EXECUTION`, `CLOSED` — في Phase 2 تُستخدم `NEW` و `ACTIVE` فقط.
- `StageStatus`: 7 قيم كاملة من التقنية §7.2 — في Phase 2 تُستخدم `REGISTERED` و `ASSIGNED`.
- `PublicEntityPosition`: `PLAINTIFF`, `DEFENDANT`.

## 3) Migrations (2 جديدتان)
| الإصدار | الملف | المحتوى |
|---|---|---|
| V6 | `db/migration/V6__litigation_cases.sql` | جدول `litigation_cases` + فهارس + CHECK enums |
| V7 | `db/migration/V7__case_stages.sql` | جدول `case_stages` + فهارس + CHECK enums |

> لا migrations seed جديدة. لا تعديل على V1..V5 من المرحلة 1.

## 4) APIs المنفَّذة (Phase 2 فقط)
> Base path `/api/v1`. لا توجد endpoints أخرى من هذه الوحدة.

| Method | Path | Status | الصلاحية |
|---|---|---|---|
| POST | `/api/v1/cases` | 201 | SECTION_HEAD أو ADMIN_CLERK مع تفويض `CREATE_CASE` |
| GET  | `/api/v1/cases?page=&size=` | 200 | حسب D-021 (scope filtering) |
| GET  | `/api/v1/cases/{id}` | 200 / 403 / 404 | حسب D-021 |
| PUT  | `/api/v1/cases/{id}/basic-data` | 200 | SECTION_HEAD أو ADMIN_CLERK مع `EDIT_CASE_BASIC_DATA` |
| POST | `/api/v1/cases/{id}/assign-lawyer` | 200 | SECTION_HEAD أو ADMIN_CLERK مع `ASSIGN_LAWYER` |

## 5) قواعد العمل المُفعَّلة (إلزاميًا في الخادم)
### عند إنشاء الدعوى (`POST /cases`)
1. تكامل scope: `OrganizationService.validateConsistency(branch, dept, court)` يتحقق من:
   - `Department.branchId == branch`
   - `Court.branchId == branch`
   - `Court.departmentType == Department.type`
   - وإلا → `400 INCONSISTENT_SCOPE`.
2. صلاحيات: `AuthorizationService.requireCaseManagement(actor, branch, dept, CREATE_CASE)`.
3. الحقول المطلوبة كلها موجودة (Bean Validation): `originalBasisNumber`, `originalRegistrationDate`, `firstHearingDate`, `firstPostponementReason`, …
4. ضمن نفس المعاملة:
   - يُنشأ `LitigationCase` بـ `lifecycleStatus = NEW`.
   - تُنشأ المرحلة الأولى بـ `stageStatus = REGISTERED`، `readOnly = false`.
   - يُحدَّث `currentStageId` على الـ case.
5. يُنشر `CaseRegisteredEvent` (لا مستهلك حاليًا).

### عند تعديل البيانات الأساسية (`PUT /cases/{id}/basic-data`)
- لا حقل `originalRegistrationDate` في الـ request ⇒ **immutable**.
- لا حقول للـ `ownership` (currentOwnerUserId) ولا `stage status` ⇒ **محظور التعديل**.
- إن كانت المرحلة الحالية `is_read_only = true` ⇒ `400 STAGE_READ_ONLY` (تمهيد لمرحلة 4).
- تعديل `courtId` يُعيد `validateConsistency` ضمن نفس الفرع/القسم.
- الحقلان الانتقاليان `firstHearingDate` و `firstPostponementReason` قابلان للتحديث (مرجع §4.7 + D-020).

### عند إسناد المحامي (`POST /cases/{id}/assign-lawyer`)
1. `AuthorizationService.requireCaseManagement(actor, case.branch, case.dept, ASSIGN_LAWYER)`.
2. المرحلة الحالية موجودة وغير read-only.
3. **المحامي عضو فعّال بدور `STATE_LAWYER` في نفس قسم الدعوى** (`AuthorizationService.isActiveMemberOf`). وإلا `403`.
4. **المحامي يملك `UserCourtAccess` فعّال على المحكمة** (`hasCourtAccess`). وإلا `403`.
5. ضمن نفس المعاملة:
   - `stage.assignedLawyerUserId = lawyerId`، `stage.stageStatus = ASSIGNED`.
   - `case.currentOwnerUserId = lawyerId`، `case.lifecycleStatus = ACTIVE`.
6. يُنشر `LawyerAssignedEvent`.

## 6) كيف خُزّن first hearing / first postponement reason — D-020
- حقلان مباشران على `CaseStage`:
  - `first_hearing_date` (NOT NULL، `LocalDate`)
  - `first_postponement_reason` (NOT NULL، VARCHAR 200 — نص حر مؤقت)
- لا `HearingProgressionEntry` بعد (مرحلة 3).
- في المرحلة 3 سيُنشئ Migration واحد `HearingProgressionEntry` تلقائيًا لكل `CaseStage` موجود بنوع `INITIAL` مبنيًا على هذين الحقلين، مع إبقاء العمودين في الـ DB كأرشيف وعدم كشفهما لاحقًا في APIs الترحيل.
- في Phase 2 الحقلان قابلان للتعديل عبر `UpdateBasicDataRequest` (مرجع §4.7).
- **ممنوع** اعتبارهما سجلًا للجلسات أو محاولة الترحيل من خلالهما.

## 7) كيف فُعّلت Ownership فعليًا
1. `CaseOwnershipPort` (interface في `access.application`) يعرض:
   - `Optional<Long> findCurrentOwner(caseId)`
   - `Optional<CaseScope> findCaseScope(caseId)`
2. `CaseOwnershipAdapter` في `litigationregistration.infrastructure` يُنفّذها كـ Spring Bean بقراءة `LitigationCaseRepository`.
3. `AuthorizationService.requireCaseOwnership(ctx, caseId)` (لم تعد placeholder):
   - تحمّل الـ owner من الـ port.
   - ترمي `403` إن لم يكن الـ actor هو المالك.
4. هذا يلتزم بـ DOMAIN_BOUNDARIES.md: لا تستدعي وحدة access مستودعات وحدة litigationregistration مباشرة؛ التواصل عبر port.
5. `requireCaseOwnership` لا تُستهلك بعد في endpoints المرحلة 2 (لأنها كلها management-centric)، لكنها **جاهزة للاستهلاك** في المرحلة 3 عند ظهور endpoints المحامي-centric (ترحيل/فصل).

## 8) قاعدة scope القراءة (D-021) — مُفعَّلة
في `LitigationCaseService.buildScopeSpec(ctx)` يُبنى JPA `Specification`:
- supervisors: `cb.conjunction()` (يرى الكل).
- branch heads: `createdBranchId IN headOfBranches`.
- section heads / clerks: `(branchId, departmentId) IN active memberships`.
- state lawyers: `currentOwnerUserId == userId`.
- بدون أي مسار: `cb.disjunction()` (نتيجة فارغة).

`GET /cases` يُرجع `PageResponse<LitigationCaseDto>` مع `page` (افتراضي 0) و `size` (افتراضي 20، حد أقصى 100).
`GET /cases/{id}` يستخدم `requireReadAccessToCase` ويعطي `403` إن خرج عن النطاق.

## 9) الأحداث الداخلية
- `CaseRegisteredEvent(caseId, stageId, branchId, departmentId, courtId, createdByUserId, initialOwnerUserId, occurredAt)`
- `LawyerAssignedEvent(caseId, stageId, lawyerUserId, actorUserId, occurredAt)`
- يُنشران عبر `ApplicationEventPublisher`.
- **لا مستهلكين الآن**. Notifications/Audit يُربطان في المراحل اللاحقة.

## 10) الاختبارات
- **Unit (لا تحتاج Docker):**
  - `AuthorizationContextUnitTest` (4) — مرحلة 1.
  - `CaseReadScopeUnitTest` (5) — D-021 (CENTRAL/BranchHead/SectionHead/StateLawyer/Unknown).
  - **النتيجة:** 9/9 ✅.
- **Integration (Testcontainers — تحتاج Docker daemon شغّالًا):**
  - `OrganizationApiIT`, `AuthApiIT`, `AccessControlApiIT` — مرحلة 1.
  - `CasesApiIT` — مرحلة 2 يغطي:
    1. ✅ إنشاء دعوى ناجح
    2. ✅ رفض إنشاء عند court خارج الفرع (`INCONSISTENT_SCOPE`)
    3. ✅ تعديل basic data ناجح + التحقق من ثبات `originalRegistrationDate`
    4. ✅ ثبات `originalRegistrationDate` (لا حقل في request)
    5. ✅ إسناد محامٍ ناجح + ownership يصبح صحيحًا
    6. ✅ رفض الإسناد لمحامٍ بدون `UserCourtAccess`
    7. ✅ رفض الإسناد لمحامٍ خارج القسم
    8. ✅ scope القراءة: رئيس قسم آخر لا يرى دعوانا، محامي يرى المُسندة فقط
    9. ✅ رفض المجهول

## 11) ما هو خارج نطاق Phase 2 (للتذكير)
- لا `HearingProgressionEntry` ولا API ترحيل.
- لا `CaseDecision` ولا فصل.
- لا سجل فصل.
- لا ترقية للاستئناف ولا للتنفيذ.
- لا مرفقات/تذكيرات/إشعارات.
- لا frontend.
- لا أي endpoint غير المذكور في §4.

