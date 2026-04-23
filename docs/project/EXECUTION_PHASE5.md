# EXECUTION_PHASE5

> Phase 5 — execution module (مسار التنفيذ بوصفه مسارًا منفصلًا عن الجلسات).
> هذه الوثيقة تشرح ما تم بناؤه في المرحلة 5 فقط. لا يتضمن المرفقات أو
> التذكيرات أو الإشعارات أو المكتبة القانونية أو دليل الجهات أو الواجهة.

---

## 1) النطاق

تنفيذ مسار التنفيذ ككيان مستقل بحيث يصبح بالإمكان:
- ترقية دعوى مفصولة (`FINALIZED`) إلى ملف تنفيذي مستقل.
- إنشاء `ExecutionFile` غير مرتبط بـ `CaseStage` كمسار جديد (D-003).
- إضافة خطوات تنفيذية مؤرَّخة (`ExecutionStep`) append-only.
- قراءة الملف التنفيذي وخطواته مع احترام scope الفروع/الأقسام/الإسناد.
- تحديث `LitigationCase.lifecycle_status` إلى `IN_EXECUTION`.

النطاق **لا** يشمل: المرفقات، التذكيرات، الإشعارات، المكتبة القانونية،
دليل الجهات العامة، التعاميم، الواجهة الأمامية، أي endpoint خارج قائمة Phase 5.

---

## 2) الكيانات الجديدة

### 2.1 `ExecutionFile` (D-028)
ملف تنفيذي مستقل لكل دعوى مُرَقَّاة.

| الحقل | النوع | ملاحظات |
|---|---|---|
| `id` | `BIGSERIAL` | PK |
| `litigation_case_id` | `BIGINT NOT NULL` | FK → litigation_cases |
| `source_stage_id` | `BIGINT NOT NULL` | FK → case_stages (المرحلة المرقَّاة) |
| `enforcing_entity_name` | `VARCHAR(200)` | snapshot نصي |
| `executed_against_name` | `VARCHAR(200)` | snapshot نصي |
| `execution_file_type` | `VARCHAR(64)` | نص حر مبدئيًا |
| `execution_file_number` | `VARCHAR(64)` | جزء من المفتاح الفريد |
| `execution_year` | `INT` | جزء من المفتاح الفريد |
| `branch_id`, `department_id` | `BIGINT NOT NULL` | قسم EXECUTION ضمن نفس الفرع |
| `assigned_user_id` | `BIGINT NULL` | المُسنَد (المالك السابق إن وُجد، D-032) |
| `status` | `VARCHAR(32)` | `OPEN/IN_PROGRESS/CLOSED/ARCHIVED` |
| `created_by_user_id`, `created_at`, `updated_at` | — | audit |

قيود:
- `chk_ef_status` على `status`.
- `uq_ef_number_year_branch` UNIQUE `(branch_id, execution_year, execution_file_number)`.
- فهارس على `litigation_case_id`, `(branch_id, department_id)`, `assigned_user_id`, `status`, `source_stage_id`.

### 2.2 `ExecutionStep` (D-031) — append-only
خطوة تنفيذية مؤرَّخة.

| الحقل | النوع | ملاحظات |
|---|---|---|
| `id` | `BIGSERIAL` | PK |
| `execution_file_id` | `BIGINT NOT NULL` | FK → execution_files |
| `step_date` | `DATE NOT NULL` | تاريخ الإجراء |
| `step_type` | `VARCHAR(32)` | enum مغلقة، انظر §3.2 |
| `step_description` | `VARCHAR(2000)` | نص حر إلزامي |
| `created_by_user_id`, `created_at` | — | audit |

كل الأعمدة `updatable=false` على JPA؛ لا setters عمومية. الـ repository يَكشف
فقط `save` (إنشاء) و `findByExecutionFileIdOrderByStepDateAscIdAsc` و `count`.
لا API لـ PUT/DELETE.

---

## 3) Enums الجديدة

### 3.1 `ExecutionFileStatus`
`OPEN`, `IN_PROGRESS`, `CLOSED`, `ARCHIVED`.

> Phase 5 يبدأ كل ملف بـ `OPEN`. لا يوجد endpoint لتعديل الحالة في هذه المرحلة؛
> أي توسيع = قرار جديد D-035+.

### 3.2 `ExecutionStepType` (D-031)
قائمة مغلقة مبدئية (مع `OTHER` صمام أمان):

`NOTICE_REQUEST`, `NOTICE_ISSUED`, `SEIZURE_REQUEST`, `SEIZURE_PLACED`,
`PAYMENT_RECORDED`, `ADMIN_ACTION`, `CLOSURE`, `OTHER`.

محصورة بـ `chk_es_type` في DB.

### 3.3 `DelegatedPermissionCode` (D-030) — إضافات
- `PROMOTE_TO_EXECUTION`
- `ADD_EXECUTION_STEP`

لا migration لازمة (`permission_code` بلا CHECK في V3).

---

## 4) Migrations

- `V13__execution_files_and_steps.sql` — الجدولان + القيود + الفهارس.
- **لا V14**. التحقق:
  - `LifecycleStatus.IN_EXECUTION` موجود في `chk_lc_lifecycle` (V6).
  - `StageStatus.PROMOTED_TO_EXECUTION` موجود في `chk_cs_status` (V7).

---

## 5) APIs Phase 5 (تحت `/api/v1`)

| Method | Path | الصلاحية | ملاحظات |
|---|---|---|---|
| POST | `/cases/{caseId}/promote-to-execution` | SECTION_HEAD لقسم الدعوى أو ADMIN_CLERK مع `PROMOTE_TO_EXECUTION` | يُنشئ ExecutionFile ويرقي الدعوى |
| GET  | `/execution-files?branchId&departmentId&status&year&page&size` | كل الأدوار حسب D-032 | scope في WHERE |
| GET  | `/execution-files/{id}` | scope D-032 على السجل | 403 إن خارج النطاق |
| POST | `/execution-files/{id}/steps` | SECTION_HEAD/ADMIN_CLERK(+`ADD_EXECUTION_STEP`)/المُسنَد | append-only |
| GET  | `/execution-files/{id}/steps` | scope D-032 على الملف | مرتَّب step_date ASC, id ASC |

**خارج Phase 5** صراحةً: PUT/DELETE على /steps، تعديل حالة الملف، إسناد محامي
بعد الإنشاء، أي endpoint آخر.

---

## 6) شرح promote-to-execution

تسلسل العمليات (`ExecutionService.promoteCaseToExecution`):
1. تحميل `CaseAndCurrentStage` عبر `CaseStagePort.findCaseWithCurrentStage`.
2. التحقق من صلاحية `PROMOTE_TO_EXECUTION` على (branch, dept) عبر
   `AuthorizationService.requireCaseManagement` (D-030).
3. قواعد العمل (D-029):
   - `currentStageStatus == FINALIZED`، وإلا `400 STAGE_NOT_FINALIZED`.
   - `!currentStageReadOnly`، وإلا `409 STAGE_ALREADY_PROMOTED`.
   - `lifecycleStatus ∈ {ACTIVE, IN_APPEAL}`، وإلا `409 INVALID_LIFECYCLE_FOR_EXECUTION`.
   - **لا قيد على `decisionType`** (مرآة موقف D-026 المحافِظ).
   - **لا قيد على `stage_type`** (يُسمح من CONCILIATION/FIRST_INSTANCE/APPEAL طالما FINALIZED).
4. التحقق من تفرّد `(branch_id, execution_year, execution_file_number)` (`409 EXECUTION_FILE_NUMBER_DUPLICATE`).
5. تحديد قسم EXECUTION ضمن نفس الفرع عبر `OrganizationService.findDepartment(branchId, EXECUTION)`
   (D-033)، وإلا `409 NO_EXECUTION_DEPARTMENT_IN_BRANCH`.
6. كتابة ذرّية على litigationregistration عبر
   `CaseStagePort.promoteCurrentStageToExecution`:
   - المرحلة السابقة: `read_only=true`, `stage_status=PROMOTED_TO_EXECUTION`,
     `ended_at = now` (إن لم يكن مُحدَّدًا).
   - **لا تُنشأ CaseStage جديدة** (D-003).
   - `LitigationCase.lifecycle_status = IN_EXECUTION`، `current_owner_user_id = null`.
   - `current_stage_id` يبقى مشيرًا للمرحلة السابقة كمرجع تاريخي للقراءة (D-034).
7. إنشاء `ExecutionFile` مع `assigned_user_id = previousOwnerUserId` (D-032).
8. نشر `CasePromotedToExecutionEvent` (لا مستهلكين بعد).

**لا يلمس** `HearingProgressionEntry` بتاتًا، ولا ينسخ التاريخ، ولا يُنشئ خطوات
تلقائية في الملف التنفيذي.

---

## 7) Read scope (D-032)

تطابق `ExecutionScope.from(ctx)`:
- `CENTRAL_SUPERVISOR / READ_ONLY_SUPERVISOR / SPECIAL_INSPECTOR` → ALL.
- `BRANCH_HEAD` → `branch_id IN headBranches`.
- `SECTION_HEAD / ADMIN_CLERK` → `(branch * 1_000_000 + dept) IN branchDeptKeys`.
- `STATE_LAWYER` (بدون عضوية إدارية) → `assigned_user_id = me`.
- وإلا → NONE.

Precedence: BRANCH_HEAD > SECTION_HEAD/CLERK > LAWYER (مرآة Phase 4).

> الفرق الوحيد عن Phase 4: ownership = `execution_files.assigned_user_id`
> (وليس `litigation_cases.current_owner_user_id`)، لأن المالك القديم يُنزع
> أثناء الترقية ويُنقَل كـ `assigned_user_id` المبدئي للملف.

التحقق:
- في `list`: يُحقن في WHERE clause عبر JPA Specification.
- في `get`/`listSteps`: يُحقَّق على السجل المفرد بعد القراءة (`scope.matches(...)`).

---

## 8) Append-only enforcement (D-031)

طبقات الإكراه:
1. **Domain**: `ExecutionStep` بلا `@Setter`، كل عمود `@Column(updatable=false)`،
   بناء عبر `@Builder` فقط.
2. **Repository**: `ExecutionStepRepository` يُستخدم فقط لـ `save` (إنشاء) و
   `findByExecutionFileIdOrderByStepDateAscIdAsc` و `countByExecutionFileId`.
   لا استدعاء لـ `delete*`/`saveAll(updates)` في أي مكان.
3. **API**: لا `PUT /steps/{id}` ولا `DELETE`.
4. **Test**: `ExecutionStepAppendOnlyUnitTest` يُثبت غياب setters + بناء
   عبر Builder. `ExecutionApiIT.test8_noUpdateOrDeleteOnSteps` يُثبت رفض
   PUT/DELETE من Spring (404/405).

---

## 9) الأحداث

- `CasePromotedToExecutionEvent(caseId, sourceStageId, executionFileId, actorUserId, occurredAt)`
- `ExecutionStepAddedEvent(executionFileId, stepId, stepType, actorUserId, occurredAt)`

لا مستهلكين في Phase 5. تُترك للمرحلة 6 (notifications/audit).

---

## 10) الاختبارات

### Unit (لا Docker) — مضافة في Phase 5
- `ExecutionEnumsUnitTest` (2)
- `ExecutionStepAppendOnlyUnitTest` (2)
- `ExecutionScopeUnitTest` (13)
- `DelegatedPermissionCodeUnitTest` — حُدِّث ليتضمن `PROMOTE_TO_EXECUTION` و `ADD_EXECUTION_STEP`.

**نتيجة `mvn test -Dtest=*UnitTest`**: 36/36 ✅.

### Integration (Testcontainers) — `ExecutionApiIT`
يغطي السيناريوهات 1..12 من برومبت Phase 5:
1. `test1_promoteToExecutionSuccess_linksCaseAndSourceStage_andSetsLifecycle` — 1+2+3+12.
2. `test4and5_listAndGetRespectScope` — 4+5.
3. `test6and7_addStepAndListOrdered` — 6+7.
4. `test8_noUpdateOrDeleteOnSteps` — 8.
5. `test9_promoteRejectedFromUnauthorizedRoles` — 9.
6. `test10_addStepRejectedFromUnauthorizedRoles` — 10.
7. `test11and12_hearingHistoryPreservedAndExecutionDoesNotTouchIt` — 11+12.
8. `test_promoteRejectedWhenStageNotFinalized`, `test_anonymousRejected` — bonuses.

> الـ IT تتطلب Docker daemon للـ Postgres testcontainer.

---

## 11) ما لم يُنفَّذ هنا (مُؤجَّل لـ Phase 6+)

- المرفقات (attachments).
- التذكيرات (reminders) والإشعارات (notifications).
- المكتبة القانونية ودليل الجهات العامة والتعاميم.
- أي صفحات frontend.
- endpoint لتعديل `ExecutionFile.status`.
- endpoint لإسناد/تغيير `assigned_user_id` بعد الإنشاء.
- DB-level trigger لمنع UPDATE/DELETE على execution_steps (الطبقات 1-4 كافية).
- Reference Table لـ `execution_file_type` أو `step_type`.

أي تمدّد لاحق يحتاج قرارًا جديدًا D-035+.

