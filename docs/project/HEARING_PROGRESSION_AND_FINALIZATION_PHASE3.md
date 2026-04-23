# HEARING_PROGRESSION_AND_FINALIZATION_PHASE3
## ترحيل الجلسات + الفصل وتسجيل القرار — المرحلة 3

> هذه الوثيقة مرجع تقني سريع لما تم بناؤه فعليًا في Phase 3.
> المرجع الأعلى يبقى الوثيقتان العربيتان + قرارات `PROJECT_ASSUMPTIONS_AND_DECISIONS.md`.

---

## 1) ما الذي بُني
**وحدتان جديدتان** بنفس بنية باقي المشروع:
```
sy.gov.sla.litigationprogression/
├── domain/        HearingProgressionEntry, EntryType, PostponementReason
├── infrastructure/ HearingProgressionEntryRepository, PostponementReasonRepository
├── application/   HearingProgressionService, HearingRolledOverEvent
└── api/           StagesController + DTOs

sy.gov.sla.decisionfinalization/
├── domain/        CaseDecision, DecisionType
├── infrastructure/ CaseDecisionRepository
├── application/   DecisionFinalizationService, CaseFinalizedEvent
└── api/           FinalizationController + DTOs
```
بالإضافة إلى **Port + Adapter** في وحدة litigationregistration الموجودة (D-023):
- `litigationregistration/application/CaseStagePort` (interface)
- `litigationregistration/infrastructure/CaseStagePortAdapter` (impl)

ودالة جديدة `listStages` في `LitigationCaseService` + endpoint `GET /api/v1/cases/{id}/stages` على `CasesController`.

## 2) الكيانات المنفذة (3)
### `HearingProgressionEntry` — append-only
الحقول: `id, case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label, entered_by_user_id, entry_type, created_at`.
- كل أعمدة JPA معلَّمة `updatable=false`.
- لا setters عمومية على الكيان (Lombok `@Setter` غير مفعّل) — التحقق آلي عبر `HearingProgressionAppendOnlyUnitTest`.
- `entry_type` ∈ {`INITIAL`, `ROLLOVER`, `FINALIZED`}.

### `CaseDecision`
الحقول: `id, case_stage_id (UNIQUE), decision_number, decision_date, decision_type, adjudged_amount, currency_code, summary_notes, finalized_by_user_id, finalized_at`.
- كل أعمدة JPA معلَّمة `updatable=false`.
- `case_stage_id` UNIQUE ⇒ قرار واحد فقط لكل مرحلة.

### `PostponementReason` — Reference Table (D-008/D-022)
الحقول: `code (PK), label_ar, is_active`.
- 8 قيم مبذورة في V8 (تبليغ/إخطار الأطراف، كشف وخبرة، جواب الإدارة/الخصم، تدقيق، تبليغ/إخطار بالصحف).

### Enum `DecisionType` (D-009 — حصري)
`FOR_ENTITY, AGAINST_ENTITY, SETTLEMENT, NON_FINAL`. تأكيد آلي عبر `DecisionTypeUnitTest`.

### Enum `EntryType`
`INITIAL, ROLLOVER, FINALIZED`.

## 3) Migrations (4 جديدة)
| الإصدار | الملف | المحتوى |
|---|---|---|
| V8  | `V8__postponement_reasons.sql` | جدول الأسباب + بذر 8 قيم |
| V9  | `V9__hearing_progression_entries.sql` | الجدول + فهرسان + CHECK |
| V10 | `V10__case_decisions.sql` | الجدول + UNIQUE (`case_stage_id`) + CHECK |
| V11 | `V11__backfill_initial_progression.sql` | إنشاء INITIAL لكل CaseStage موجودة (D-022) |

> لم تُعدَّل V1..V7 من المراحل السابقة.

## 4) APIs المنفَّذة (Phase 3 فقط)
> Base path `/api/v1`. لا توجد endpoints أخرى من هذه الوحدتين.

| Method | Path | الصلاحية |
|---|---|---|
| GET  | `/api/v1/cases/{id}/stages` | scope قراءة الدعوى (D-021) |
| GET  | `/api/v1/stages/{stageId}` | scope قراءة الدعوى (D-021) |
| GET  | `/api/v1/stages/{stageId}/progression` | scope قراءة الدعوى (D-021) |
| GET  | `/api/v1/stages/{stageId}/hearing-history` | scope قراءة الدعوى (D-021) |
| POST | `/api/v1/stages/{stageId}/rollover-hearing` | المحامي المُسنَد فقط (D-024) |
| POST | `/api/v1/stages/{stageId}/finalize` | المحامي المُسنَد فقط (D-024) |

## 5) ترحيل D-020 إلى HearingProgressionEntry — كيف تم
1. **V11 Migration backfill**: تنفيذ `INSERT … SELECT` يُنشئ INITIAL entry لكل `case_stage` موجود:
   - `hearing_date` = `case_stages.first_hearing_date`
   - `postponement_reason_label` = `case_stages.first_postponement_reason` (نص حرفي محفوظ كأرشيف)
   - `postponement_reason_code` = `NULL` (نصوص Phase 2 كانت حرة)
   - `entered_by_user_id` = `litigation_cases.created_by_user_id` (المُنشئ الأصلي)
   - `entry_type` = `'INITIAL'`
   - `created_at` = `case_stages.started_at`
2. **حماية ضد التكرار**: `WHERE NOT EXISTS … entry_type='INITIAL'` يجعل الـ migration idempotent عمليًا (Flyway لا يعيد تشغيلها أصلًا، لكن هذه طبقة أمان إضافية).
3. **بعد الترحيل**: الأعمدة `first_hearing_date` و `first_postponement_reason` تبقى في `case_stages` كأرشيف:
   - APIs Phase 3 الجديدة **لا تقرأها** ولا تكشفها — كل القراءة تمر عبر `HearingProgressionEntry`.
   - `PUT /cases/{id}/basic-data` يبقى يعدّلها (لا كسر للعقد) لكنها **deprecated** ولا تُترجم إلى entry جديدة.
   - الحذف الفعلي للأعمدة يُؤجَّل لمرحلة لاحقة بعد التأكد من عدم وجود مستهلك.
4. **القاعدة الجديدة**: أي entry جديدة من `INITIAL`/`ROLLOVER` تتطلب `postponement_reason_code` صحيحًا في الجدول المرجعي؛ مرفوضة بـ `400 INVALID_POSTPONEMENT_REASON` خلاف ذلك.

## 6) كيف فُرض append-only
طبقات الدفاع المتعددة:
1. **مستوى الكيان (JPA)**: كل أعمدة `HearingProgressionEntry` و `CaseDecision` معلَّمة `updatable=false` ⇒ Hibernate يتجاهل أي تعديل ضمني عبر dirty tracking.
2. **مستوى التصميم**: لا setters عمومية على `HearingProgressionEntry` (لا `@Setter` Lombok) — يُتحقَّق آليًا عبر `HearingProgressionAppendOnlyUnitTest.noPublicSettersOnEntity`.
3. **مستوى الـ Application**:
   - `HearingProgressionService` يعرض `rolloverHearing` و `appendInternal` فقط — لا توجد طريقة `update*` أو `delete*` على الإطلاق.
   - `appendInternal` للاستخدام الداخلي بين الوحدات (D-023) لإلحاق `FINALIZED` من `DecisionFinalizationService`.
4. **مستوى الـ API**: `StagesController` يحتوي فقط 3 GET + 1 POST (rollover) — لا PUT/DELETE/PATCH على الـ entries.
5. **اختبار التحقق التكاملي**: `test2_rolloverSucceeds_andHistoryIsAppendOnly` يُنشئ ترحيلين متتالين ويتأكد من ظهور كليهما في history مرتبًا تصاعديًا (لم يُحذف/يُعدَّل القديم).

## 7) كيف استُهلِكت ownership فعليًا (D-024)
- `POST /api/v1/stages/{stageId}/rollover-hearing` و `POST /api/v1/stages/{stageId}/finalize`:
  1. تحميل `StageInfo` عبر `CaseStagePort.find(stageId)` لاستخراج `litigationCaseId`.
  2. `AuthorizationContext actor = authorizationService.loadContext(actorUserId)`.
  3. `authorizationService.requireCaseOwnership(actor, info.litigationCaseId())` — تستدعي `CaseOwnershipPort.findCurrentOwner(caseId)` (Adapter في litigationregistration) وترمي `403 FORBIDDEN` إن لم يكن `actor.userId == case.currentOwnerUserId`.
- **لا استثناء** لرئيس القسم/المركزي/الإداري في هذه العمليات اليومية. اختبار `test3_rolloverRejectedFromNonOwner` و `test5_finalizeRejectedFromNonOwner` يتحققان من رفض كل من المحامي الآخر و SECTION_HEAD بـ `403`.
- **القراءة** (`GET /stages/...`) منفصلة وتستخدم `requireReadAccessToCase` (D-021) — رئيس القسم يقرأ، لكن لا يُرحّل ولا يفصل.

## 8) حدود الوحدات (D-023)
- `litigationprogression` و `decisionfinalization` لا يمسّان `CaseStageRepository` ولا `LitigationCaseRepository` مباشرة. كل قراءة/كتابة على `CaseStage` تمر عبر `CaseStagePort`.
- استدعاءات Application↔Application مسموحة:
  - `DecisionFinalizationService` ⟶ `HearingProgressionService.appendInternal(...)` لإلحاق FINALIZED entry.
  - الوحدتان ⟶ `AuthorizationService` (للنطاق والملكية).

## 9) الأحداث الداخلية
- `HearingRolledOverEvent(stageId, caseId, entryId, entryType, previousHearingDate, newHearingDate, newReasonCode, actorUserId, occurredAt)` — يُنشر في rollover.
- `CaseFinalizedEvent(caseId, stageId, decisionId, decisionType, decisionDate, actorUserId, occurredAt)` — يُنشر في finalize.
- **لا مستهلكين الآن**. سجل الفصل + الإشعارات سيُربطان في المراحل 4–6.

## 10) قواعد العمل الإلزامية المُفعَّلة
### `POST /stages/{stageId}/rollover-hearing`
1. التحقق من وجود المرحلة وعدم كونها read-only أو FINALIZED.
2. ownership: `requireCaseOwnership` (D-024).
3. التحقق من `postponement_reason_code` في الجدول المرجعي وكونه فعّالًا (`is_active`).
4. إلحاق entry جديدة بنوع `ROLLOVER` فقط.
5. تحديث حالة المرحلة من `REGISTERED`/`ASSIGNED` إلى `IN_PROGRESS` (لا تتغير لاحقًا).
6. نشر `HearingRolledOverEvent` مع تاريخ الجلسة السابقة (إن وجدت).

### `POST /stages/{stageId}/finalize`
1. التحقق من عدم كون المرحلة FINALIZED مسبقًا (`409 STAGE_ALREADY_FINALIZED`) وعدم وجود قرار سابق (`409 DECISION_EXISTS`).
2. التحقق من تطابق `adjudgedAmount` مع `currencyCode` (إما الاثنان أو لا شيء — `400 AMOUNT_CURRENCY_INCONSISTENT`).
3. ownership: `requireCaseOwnership` (D-024).
4. إنشاء `CaseDecision`.
5. إلحاق entry بنوع `FINALIZED` (label = "تم الفصل"، code = NULL، hearing_date = decision_date).
6. `CaseStagePort.markFinalized(stageId, now)` ⇒ `stageStatus = FINALIZED` و `endedAt = now`.
7. `lifecycle_status` على `LitigationCase` يبقى `ACTIVE` — التحول إلى سجل الفصل والانتقال = **مرحلة 4**.
8. نشر `CaseFinalizedEvent`.

### قراءة `progression`
projection يعرض:
- `latestStageStatus` من `CaseStage`.
- `currentHearingDate/Code/Label` = آخر entry غير FINALIZED.
- `previousHearingDate/Code/Label` = الـ entry قبل الأخيرة (أو null إن لا توجد).

### قراءة `hearing-history`
كل entries مرتبة `created_at ASC`، بدون أي تعديل أو حذف.

## 11) الاختبارات
### Unit (لا تحتاج Docker) — 13/13 ✅
- `AuthorizationContextUnitTest` (4) — Phase 1
- `CaseReadScopeUnitTest` (5) — Phase 2
- `DecisionTypeUnitTest` (1) — Phase 3 (D-009 حصرية)
- `HearingProgressionAppendOnlyUnitTest` (3) — Phase 3 (لا setters + EntryType + builder)

### Integration (Testcontainers — تحتاج Docker daemon)
- مرحلة 1: `OrganizationApiIT`, `AuthApiIT`, `AccessControlApiIT`
- مرحلة 2: `CasesApiIT`
- **مرحلة 3: `ProgressionAndFinalizationIT`** يغطي 10 سيناريوهات:
  1. ✅ INITIAL via backfill (V11) أو فارغ على دعوى جديدة
  2. ✅ ترحيل ناجح + history مرتبة + append-only
  3. ✅ رفض rollover من مستخدم ليس مالكًا (محامٍ آخر **و** رئيس قسم)
  4. ✅ finalize ناجح + `stageStatus=FINALIZED` + entry FINALIZED + قرار محفوظ
  5. ✅ رفض finalize من غير مالك (محامي آخر **و** رئيس قسم)
  6. ✅ `decisionType` غير صالح ⇒ 400
  7. ✅ `postponementReasonCode` غير معروف ⇒ 400 `INVALID_POSTPONEMENT_REASON`
  8. ✅ finalize بعد finalize ⇒ 409، rollover بعد finalize ⇒ 400
  9. ✅ المجهول مرفوض على كل endpoints المرحلة
  10. ✅ `adjudgedAmount` بدون `currencyCode` ⇒ 400 `AMOUNT_CURRENCY_INCONSISTENT`

> تشغيل: `mvn test` بعد تفعيل Docker Desktop. أو `mvn -Dtest=AuthorizationContextUnitTest,CaseReadScopeUnitTest,DecisionTypeUnitTest,HearingProgressionAppendOnlyUnitTest test` للاكتفاء بالـ unit.

## 12) ما هو خارج نطاق Phase 3 (للتذكير)
- لا **سجل فصل (Read Model)** ⇐ مرحلة 4.
- لا **promote-to-appeal** ⇐ مرحلة 4.
- لا **promote-to-execution** ⇐ مرحلة 5.
- لا **execution files** ⇐ مرحلة 5.
- لا **مرفقات/تذكيرات/إشعارات** ⇐ مرحلة 6.
- لا **frontend**.
- لا أي endpoint غير المذكور في §4.

