# RESOLVED_REGISTER_AND_APPEAL_PHASE4
## سجل الفصل + الانتقال إلى الاستئناف — المرحلة 4

> هذه الوثيقة مرجع تقني سريع لما تم بناؤه فعليًا في Phase 4.
> المرجع الأعلى يبقى الوثيقتان العربيتان + قرارات `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

---

## 1) ما الذي بُني
**وحدتان جديدتان:**

```
sy.gov.sla.resolvedregister/                 (Read Model مشتق فقط — D-025)
├── application/   ResolvedRegisterService
├── infrastructure/ ResolvedRegisterQueryDao  (NamedParameterJdbcTemplate)
└── api/           ResolvedRegisterController + ResolvedRegisterEntryDto

sy.gov.sla.stagetransition/                  (promote-to-appeal فقط — D-026/D-027)
├── application/   StageTransitionService + CasePromotedToAppealEvent
└── api/           StageTransitionController + PromoteToAppealResponseDto
```

**تعديلات على الوحدات الموجودة (لا كسر للحدود — D-023):**
- `access/domain/DelegatedPermissionCode` → إضافة `PROMOTE_TO_APPEAL` (D-027).
- `litigationregistration/application/CaseStagePort` → توسيع بـ `findCaseWithCurrentStage` و `promoteCurrentStageToAppeal` و records جديدة (`CaseAndCurrentStage`, `NewAppealStageInfo`).
- `litigationregistration/infrastructure/CaseStagePortAdapter` → تنفيذ العمليات الجديدة (الكتابة الذرّية فقط، بدون منطق التحقق).

> الكتابات على Case/CaseStage تبقى محصورة في وحدة litigationregistration. وحدة `stagetransition` تتولى التحقق + الصلاحية + النشر فقط.

## 2) الكيانات
**لا كيانات JPA جديدة.** هذا مقصود:
- **resolved-register**: Read Model مشتق منطقيًا — لا جدول جديد، لا duplicated truth (D-025).
- **stage-transition**: orchestration service فقط — يحرّك CaseStage/LitigationCase الموجودَين عبر Port.

## 3) Migrations (1 جديدة)
| الإصدار | الملف | المحتوى |
|---|---|---|
| V12 | `V12__case_stages_parent_index.sql` | فهرس جزئي على `case_stages(parent_stage_id)` لتسريع تتبع سلاسل الاستئناف |

> لا تعديل على V1..V11. لا CHECK constraints جديدة على enums (`PROMOTE_TO_APPEAL` تُخزَّن مباشرة لأن `permission_code` في V3 هي `VARCHAR(64)` بدون قيد).

## 4) APIs المنفَّذة (Phase 4 فقط)
| Method | Path | الصلاحية |
|---|---|---|
| GET  | `/api/v1/resolved-register?year=&month=&branchId=&departmentId=&decisionType=` | كل الأدوار حسب D-021/D-025 (محصور بنطاق المستخدم في WHERE clause) |
| POST | `/api/v1/cases/{caseId}/promote-to-appeal` | SECTION_HEAD أو ADMIN_CLERK مع `PROMOTE_TO_APPEAL` (D-027) |

**لا endpoints أخرى** أُضيفت في هذه المرحلة. لم يُحتج إلى endpoint إضافي لتمثيل parent stage relationship لأن `CaseStageDto` (Phase 2) يكشف `parentStageId` أصلًا.

## 5) كيف بُني سجل الفصل كمشتق منطقي (D-025)
1. **بدون أي جدول جديد**: لا `resolved_register_entries`، لا projection، لا view مادي.
2. **استعلام واحد** في `ResolvedRegisterQueryDao` يجمع 6 جداول:
   ```
   case_decisions cd
   JOIN case_stages cs       ON cs.id = cd.case_stage_id
   JOIN litigation_cases lc  ON lc.id = cs.litigation_case_id
   JOIN branches b           ON b.id  = lc.created_branch_id
   JOIN departments d        ON d.id  = lc.created_department_id
   JOIN courts c             ON c.id  = lc.created_court_id
   ```
3. **فلاتر اختيارية** عبر `NamedParameterJdbcTemplate`: `year`, `month` (`EXTRACT(YEAR/MONTH FROM cd.decision_date)`), `branchId`, `departmentId`, `decisionType`.
4. **scope filter** يُحقن في WHERE clause بناءً على `AuthorizationContext` (D-021):
   - مشرف مركزي/قراءة فقط/مفتش خاص → بدون قيد.
   - رئيس فرع → `lc.created_branch_id IN (:scopeBranches)`.
   - رئيس قسم/إداري → `(branch_id*1_000_000 + department_id) IN (:scopeKeys)` (مفتاح مركّب آمن).
   - محامي → `lc.current_owner_user_id = :ownerUserId`.
   - بدون مسار → `1=0` (نتيجة فارغة).
5. **مصدر الحقيقة الوحيد** يبقى `CaseDecision` + `CaseStage` + `LitigationCase`. أي تعديل/إضافة قرار ينعكس فورًا على السجل دون مزامنة.
6. **لا CaseFinalizedEvent consumer**: الحدث ما زال منشورًا بلا مستهلك في هذه الوحدة (محجوز لمراحل notifications/audit).

### لماذا لا projection table
- Append-only من جهة `CaseDecision` (Phase 3) ⇒ لا تحديثات ⇒ القراءة المباشرة آمنة ومتسقة دائمًا.
- 14 فرعًا × ~4 أقسام × أعداد قضايا واقعية تجعل الاستعلام رخيصًا مع الفهارس الموجودة (`ix_decisions_date`, `ix_decisions_type`, `ix_lc_branch`, `ix_lc_branch_dept`).
- لو احتجنا projection للأداء لاحقًا → قرار جديد D-028+ مع مبرر قياس.

## 6) كيف نُفّذ promote-to-appeal
### تسلسل العملية
1. **`StageTransitionController.promote(caseId)`** يستخرج `actorUserId` من `SecurityUtils`.
2. **`StageTransitionService.promoteToAppeal(caseId, actorUserId)`**:
   1. `caseStagePort.findCaseWithCurrentStage(caseId)` → `CaseAndCurrentStage` (يرمي 404 إن لم توجد).
   2. **التحقق من الحالة** (D-026 — 5 قيود فقط، بلا قيد على `decisionType`):
      - `currentStageStatus == FINALIZED` وإلا `400 STAGE_NOT_FINALIZED`.
      - `currentStageType ≠ APPEAL` وإلا `400 ALREADY_APPEAL_STAGE`.
      - `!currentStageReadOnly` وإلا `409 STAGE_ALREADY_PROMOTED`.
      - `lifecycleStatus ∈ {NEW, ACTIVE}` وإلا `409 INVALID_LIFECYCLE_FOR_APPEAL`.
   3. **التحقق من الصلاحية** (D-027): `requireCaseManagement(actor, branch, dept, PROMOTE_TO_APPEAL)`:
      - SECTION_HEAD لقسم الدعوى → مسموح دائمًا.
      - ADMIN_CLERK لقسم الدعوى مع `PROMOTE_TO_APPEAL = granted=true` → مسموح.
      - أي شيء آخر (بما فيه المحامي المُسنَد) → `403`.
   4. **الكتابة الذرّية** عبر `caseStagePort.promoteCurrentStageToAppeal(caseId, actorUserId)`.
   5. نشر `CasePromotedToAppealEvent` (لا مستهلكين الآن).
3. **`CaseStagePortAdapter.promoteCurrentStageToAppeal(...)`** ضمن transaction واحدة:
   - **المرحلة السابقة**: `read_only = true`، `stage_status = PROMOTED_TO_APPEAL`، `endedAt = now` (إن لم يُملأ سابقًا).
   - **المرحلة الجديدة (APPEAL)**: تُنشأ بـ:
     - `litigation_case_id = caseId`
     - `stage_type = APPEAL`
     - `branch_id / department_id / court_id / chamber_name` = نفس السابقة (نقطة بداية، يمكن تعديلها لاحقًا عبر `PUT /cases/{id}/basic-data`)
     - `parent_stage_id = previous.id`
     - `stage_status = REGISTERED`
     - `assigned_lawyer_user_id = null` (بانتظار `assign-lawyer` جديد على مرحلة الاستئناف)
     - `read_only = false`
     - `first_hearing_date = today`، `first_postponement_reason = "تأسيس مرحلة استئناف"` (حقول D-020 الانتقالية فقط، **لا تُكشف** في APIs الجلسات لأن `HearingProgressionEntry` لم تُملأ بعد لهذه المرحلة الجديدة — هذا متسق مع D-022)
     - `started_at = now`
   - **LitigationCase**: `current_stage_id = newStage.id`، `current_owner_user_id = null`، `lifecycle_status = IN_APPEAL`، `updated_at = now`.

### الحفاظ على المُكتسبات
- `HearingProgressionEntry` للمرحلة السابقة **تبقى كما هي** (append-only — لا تُلمس). التحقق في `test7_hearingHistoryOfPreviousStageIsPreserved`.
- `CaseDecision` للمرحلة السابقة **يبقى موجودًا** (UNIQUE per stage — متاح للسجل عبر `cd.case_stage_id = previousStageId`).
- `parent_stage_id` يحفظ السلسلة كاملة للقراءة المستقبلية.
- المرحلة الجديدة **لا تنسخ** أي history قديمة — تبدأ بسجل فارغ. التحقق في `test8_newAppealStageHasIndependentEmptyHistory`.

## 7) القرارات الجديدة D-025…D-027
موثَّقة بالكامل في `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`. ملخص:
- **D-025**: resolved-register Read Model مشتق بدون projection table، بدون CaseFinalizedEvent consumer في هذه المرحلة.
- **D-026**: قيود الترقية الخمسة فقط — **لا قيد على `decisionType`** (تفسير conservative متماشٍ مع طلب المستخدم: لا تُدخل شرطًا غير منصوص).
- **D-027**: `PROMOTE_TO_APPEAL` كـ DelegatedPermissionCode جديد للموظف الإداري، بدون migration لأن `permission_code` غير مقيَّد بـ CHECK.

## 8) Read Scope في سجل الفصل
| الدور | ما يراه |
|---|---|
| `CENTRAL_SUPERVISOR` / `READ_ONLY_SUPERVISOR` / `SPECIAL_INSPECTOR` | كل القضايا المفصولة |
| `BRANCH_HEAD` | فروعه فقط (`lc.created_branch_id IN ...`) |
| `SECTION_HEAD` / `ADMIN_CLERK` | (فرع، قسم) من عضوياته فقط |
| `STATE_LAWYER` | الدعاوى التي يملكها فقط (`lc.current_owner_user_id = me`) |
| أي شيء آخر | نتيجة فارغة (`1=0`) |

> ملاحظة: عند تركيب أكثر من نوع scope على نفس المستخدم، تُختار الفئة الأعلى صلاحية في `ResolvedRegisterService.buildScope` (precedence بسيط). الحالات المتقدمة لاحقًا = قرار جديد.

## 9) الأحداث
- `CasePromotedToAppealEvent(caseId, previousStageId, newAppealStageId, actorUserId, occurredAt)` — يُنشر بعد commit.
- **لا مستهلكين**. notifications/audit في مراحل لاحقة.

## 10) الاختبارات
### Unit (لا تحتاج Docker) — 19/19 ✅
- مرحلة 1: `AuthorizationContextUnitTest` (4)
- مرحلة 2: `CaseReadScopeUnitTest` (5)
- مرحلة 3: `DecisionTypeUnitTest` (1) + `HearingProgressionAppendOnlyUnitTest` (3)
- **مرحلة 4: `DelegatedPermissionCodeUnitTest` (1) + `ResolvedRegisterScopeUnitTest` (5)**

### Integration (Testcontainers — تحتاج Docker daemon)
- مرحلة 1: `OrganizationApiIT`, `AuthApiIT`, `AccessControlApiIT`
- مرحلة 2: `CasesApiIT`
- مرحلة 3: `ProgressionAndFinalizationIT`
- **مرحلة 4: `ResolvedRegisterAndAppealIT`** يغطي 11 سيناريو:
  1. ✅ finalized case يظهر في سجل الفصل بالشهر الصحيح
  2. ✅ filter على `month` يستثني الأشهر الأخرى
  3. ✅ filter على `decisionType` يستثني الأنواع الأخرى
  4. ✅ رئيس قسم من فرع آخر **لا** يرى دعاوينا في السجل
  5. ✅ المجهول مرفوض على `/resolved-register`
  6. ✅ promote-to-appeal ناجح → `lifecycleStatus = IN_APPEAL`، `currentStageId` يتحدث، السابقة `readOnly=true` و `PROMOTED_TO_APPEAL`، الجديدة `APPEAL` مع `parentStageId` صحيح
  7. ✅ hearing history للمرحلة السابقة لا تُفقد
  8. ✅ المرحلة الجديدة تبدأ بسجل history فارغ (لا نسخ)
  9. ✅ المحامي المُسنَد **و** رئيس قسم من فرع آخر يُرفضان (403)
  10. ✅ ترقية مرحلة هي أصلًا APPEAL → 400 (تُكتشف عبر `STAGE_NOT_FINALIZED` لأن APPEAL الجديدة `REGISTERED`)
  11. ✅ ترقية دعوى دون مرحلة مفصولة → 400 `STAGE_NOT_FINALIZED`

> تشغيل: `mvn test` بعد تفعيل Docker Desktop. أو `mvn -Dtest=*UnitTest test` للاكتفاء بالـ unit.

## 11) ما هو خارج نطاق Phase 4 (للتذكير)
- لا **promote-to-execution** ⇐ مرحلة 5.
- لا **execution files** ⇐ مرحلة 5.
- لا **مرفقات / تذكيرات / إشعارات** ⇐ مرحلة 6.
- لا **audit consumer** كاملًا.
- لا **frontend**.
- لا **export CSV** (لم يُطلب فعليًا، اختياري — وسيُضاف عند الحاجة بقرار صريح).
- لا أي endpoint غير المذكورين في §4.

