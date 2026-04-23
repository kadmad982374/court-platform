# PROJECT_ASSUMPTIONS_AND_DECISIONS
## القرارات التفسيرية والافتراضات المعتمدة

> هذه الوثيقة هي **المرجع لأي قرار تفسيري** اتُّخذ بسبب نقطة احتملت أكثر من معنى في الوثيقتين.
> قاعدة العمل: عند التعارض، الوثيقة الوظيفية أعلى من التقنية، والتفسير المعتمد يُسجَّل هنا.

---

## D-001: سجل الفصل = عرض مشتق (Read Model)
- **النص الأصلي:** الوظيفية §8.4 تعتبره "عرضًا مشتقًا" + التقنية §8.4 و§10.6.
- **التفسير:** لا يُنشأ جدول مستقل للسجل؛ يُبنى من قراءة `CaseDecision` بحسب شهر `decision_date`.
- **السبب:** يمنع ازدواجية مصدر الحقيقة، ويتسق مع §20.1.6 من الوظيفية.
- **القيد:** أي تصحيح بعد الفصل يجب أن يمر عبر آلية `decision-finalization` المضبوطة لا عبر `resolved-register`.

## D-002: انتقال الاستئناف = CaseStage جديدة مرتبطة بـ parent
- **النص الأصلي:** الوظيفية §9 + التقنية §5.3 (parent_stage_id) + §8.5.
- **التفسير:** المرحلة الجديدة من نوع APPEAL ترتبط عبر `parent_stage_id`، وتصبح المرحلة الأم `is_read_only=true` و`stage_status=PROMOTED_TO_APPEAL`.
- **القيد:** لا تعديل على المرحلة الأم بعد الانتقال؛ الاطلاع متاح للمرفقات والجلسات السابقة.

## D-003: نقل التنفيذ = ExecutionFile مستقل
- **النص الأصلي:** الوظيفية §10 + التقنية §5.4 و§8.6.
- **التفسير:** التنفيذ ليس CaseStage؛ يُنشأ `ExecutionFile` مرتبط بـ `LitigationCase` وبـ `source_stage_id`، وتُحدَّث المرحلة المصدر إلى `PROMOTED_TO_EXECUTION` أو `ARCHIVED`.
- **القيد:** لا يجوز نمذجة التنفيذ كـ HearingProgressionEntry.

## D-004: الموظف الإداري يبدأ بصلاحيات رئيس القسم كاملة
- **النص الأصلي:** الوظيفية §3.6: "يملك ذات صلاحيات رئيس القسم أصلًا" + يمكن لرئيس القسم حجب بعضها أو كلها.
- **التفسير:** عند إنشاء موظف إداري ضمن قسم، تُضاف له `UserDelegatedPermission` بقيمة `granted=true` لكل صلاحية افتراضية، ويستطيع رئيس القسم تعطيلها فرديًا.
- **القيد:** قائمة الصلاحيات القابلة للتفويض محصورة، تُحدَّد في المرحلة 1.

## D-005: الفصل المباشر دون إحالة (Exception Path)
- **النص الأصلي:** الوظيفية §3.5: "في بعض الحالات الخاصة: فصل الدعوى مباشرة دون إحالتها إلى محام".
- **التفسير:** يقتصر هذا المسار على رئيس القسم (وليس الموظف الإداري افتراضيًا)، يتم بإنشاء `CaseStage` ثم استدعاء فصل مباشرة بنفس المعاملة، ويُسجَّل في Audit مع علامة `direct_finalization=true`.
- **القيد:** غير متاح للموظف الإداري إلا إذا فُوّض صراحة عبر صلاحية مخصصة.

## D-006: تاريخ القيد الأول ثابت لا يتغير
- **النص الأصلي:** الوظيفية §6.2 البند 7.
- **التفسير:** `original_registration_date` في `LitigationCase` immutable بعد الإنشاء؛ لا API لتعديله ولا مسار تصحيح.
- **القيد:** أي خطأ يستوجب إلغاء الدعوى وإنشاء جديدة (مع تسجيل Audit).

## D-007: تصحيح بيانات الدعوى المفصولة
- **النص الأصلي:** الوظيفية §3.5 + §7.4.
- **التفسير:** يُتاح لرئيس القسم تصحيح حقول محددة فقط (يحدَّد الحقول في المرحلة 3) مع `audit` كامل والإبقاء على القيمة السابقة.
- **القيد:** لا تصحيح يُغيّر شهر `decision_date` لأنه يؤثر على سجل الفصل؛ تغييره يستوجب موافقة استثنائية تُسجَّل.

## D-008: قائمة أسباب التأجيل
- **النص الأصلي:** الوظيفية §6.3: قائمة معيارية أولية + قابلية توسعة مضبوطة.
- **التفسير:** تُمثَّل كقائمة Enum/Reference Table مُدارة. التوسعة في الإصدار الأول تتم عبر بذر بيانات (Flyway) لا عبر واجهة عامة.
- **القيد:** لا يجوز للمستخدمين العاديين إضافة أسباب جديدة.

## D-009: نوع القرار حصري
- **النص الأصلي:** الوظيفية §7.2 + التقنية §5.3.
- **التفسير:** Enum مغلق: `FOR_ENTITY`, `AGAINST_ENTITY`, `SETTLEMENT`, `NON_FINAL`. لا توسعة في الإصدار الأول.

## D-010: إشعار قيد دعوى جديدة (الحد الأدنى)
- **النص الأصلي:** الوظيفية §12.3.
- **التفسير:** عند `CaseRegisteredEvent`، تُنشأ إشعارات داخلية للمستخدمين المعنيين: المحامي المسند (إن وُجد عند الإنشاء)، رئيس القسم، الموظف الإداري في نفس القسم. النطاق الأوسع (رئيس الفرع، الإدارة المركزية) لا يُشعَر افتراضيًا في الإصدار الأول.
- **القيد:** قنوات خارج التطبيق (Email/SMS/Push) خارج النطاق.

## D-011: ربط الجهة العامة بالدعوى
- **النص الأصلي:** التقنية §5.3 يستخدم `public_entity_name` كنص + وحدة `public-entity-directory` منفصلة.
- **التفسير:** الدعوى تخزن اسم الجهة كنص (لتوافق العمل التاريخي وتجنب الإلزام بمرجع مكتمل من اليوم الأول)، مع إمكانية ربط مستقبلي اختياري بمعرّف من `public-entity-directory` بدون كسر التوافق.
- **القيد:** لا يُرفض إنشاء دعوى لأن الجهة غير موجودة في الدليل.

## D-012: المصادقة JWT + Refresh
- **النص الأصلي:** الوظيفية §15 + التقنية §10.1 لم تُلزم بآلية محددة.
- **التفسير:** اعتماد JWT قصير العمر + Refresh Token. التفاصيل تُحسم في المرحلة 1.
- **القيد:** المصادقة عبر OAuth2 خارجي خارج النطاق.

## D-013: OTP وإعادة التعيين
- **النص الأصلي:** الوظيفية §15.2–15.3.
- **التفسير:** OTP يُولَّد ويُخزَّن مهشَّرًا بصلاحية محدودة (مثلاً 10 دقائق)، مع زر إعادة إرسال محدود. مزود الإرسال (SMS Provider) يُترك كـ Port قابلة للتنفيذ لاحقًا؛ في التطوير يُسجَّل للـ Console.
- **القيد:** الإرسال الفعلي عبر SMS خارج نطاق المرحلة 1.

## D-014: لغة النظام
- **النص الأصلي:** الوظيفية §16.1.
- **التفسير:** عربي بالكامل، RTL. لا توطين متعدد اللغات في الإصدار الأول.

## D-015: ترقيم الـ APIs
- **النص الأصلي:** التقنية §10.
- **التفسير:** كل APIs تحت `/api/v1/`. لا v2 في الإصدار الأول.

## D-016: نطاق إشعارات الإدارة المركزية ورئيس الفرع
- **الغموض:** هل يصلهم إشعار عند كل قيد؟
- **التفسير المعتمد:** لا، احترامًا لمبدأ الحد الأدنى وعدم إغراق الأدوار الإشرافية. يصلهم عبر شاشات الاستعراض والتقارير. (D-010).

## D-017: أرشفة شاملة (Audit + History)
- **النص الأصلي:** الوظيفية §17 + التقنية §12.
- **التفسير:** Audit عام للأحداث + سجل تاريخي مدمج في الكيانات حيث يلزم (HearingProgressionEntry append-only، نسخ قبل/بعد للتصحيحات الحساسة في `details_json` بـ Audit).

## D-018: Bootstrap CENTRAL_SUPERVISOR عند أول إقلاع
- **السياق:** الوثيقتان لم تحددا آلية إنشاء أول مستخدم في نظام بلا واجهة تسجيل ذاتي مفتوحة.
- **التفسير المعتمد:** عند بدء التشغيل لأول مرة، إن كان `sla.bootstrap.central-supervisor.enabled=true` ولم يوجد المستخدم بالاسم المحدد، يُنشأ تلقائيًا مستخدم بدور `CENTRAL_SUPERVISOR` (افتراضيًا `admin / ChangeMe!2026`).
- **القيد:**
  - مفعَّل افتراضيًا في dev، **يجب تعطيله في الإنتاج** بعد إنشاء أول مستخدم بشري.
  - كلمة المرور الابتدائية يجب تغييرها فورًا.
  - بدور CENTRAL_SUPERVISOR فقط بحسب §3.1 من الوظيفية: قراءة شاملة، بدون تعديل افتراضي.
- **مرجع الكود:** `identity.bootstrap.BootstrapAdminRunner`.

## D-019: Refresh Token rotation + إبطال شامل عند تغيير كلمة المرور
- **السياق:** الوثيقتان لم تحددا تفاصيل آلية الـ refresh.
- **التفسير المعتمد:**
  - عند كل `/refresh-token` نُلغي القديم ونُصدر جديدًا (rotation).
  - تخزين token هاش (SHA-256) فقط في DB، لا plaintext.
  - عند `reset-password` ينجح، تُلغى **كل** الـ refresh tokens النشطة لذلك المستخدم.
  - `/logout` يُبطل التوكن المُمرَّر فقط (لا global logout).
- **القيد:** Access token قصير العمر (افتراضي 30 دقيقة) لا يُلغى مركزياً قبل انتهاء صلاحيته (نمط JWT stateless طبيعي).

## D-020: التخزين الانتقالي لـ first hearing date / first postponement reason في CaseStage
- **السياق:** الوظيفية §6.2 توجب تخزين تاريخ الجلسة الأولى وسبب التأجيل الأول لحظة القيد. وحدة `litigation-progression` و كيانها `HearingProgressionEntry` (أفعال append-only) لن تُنفَّذ إلا في المرحلة 3.
- **التفسير المعتمد:**
  - في المرحلة 2 يُخزَّن الحقلان مباشرةً على `CaseStage` كحقلين انتقاليين:
    - `first_hearing_date` (LocalDate)
    - `first_postponement_reason` (VARCHAR، نص حر مؤقت لا قائمة محصورة بعد — القائمة المعيارية تُفعَّل في المرحلة 3)
  - عند بداية المرحلة 3، Migration واحد يُنشئ `HearingProgressionEntry` تلقائيًا لكل `CaseStage` موجود مبنيًا على هذين الحقلين بنوع `INITIAL`، ثم يُمكن (ليس إلزاميًا) Deprecate الحقلين على مستوى الـ API لكن إبقاؤهما في الـ DB لأغراض التتبع التاريخي.
  - الحقلان يبقيان قابلين للتعديل ضمن "البيانات الأساسية" (الوظيفية §4.7) في المرحلة 2 من قبل رئيس القسم/الموظف الإداري المفوّض.
- **القيد:**
  - لا يجوز اعتبار هذين الحقلين سجلًا للجلسات؛ هما لقطة قيد فقط.
  - أي ترحيل جلسة لاحق يجب أن يمر عبر `HearingProgressionEntry` (المرحلة 3) لا تعديل هذين الحقلين.

## D-022: ترحيل D-020 إلى HearingProgressionEntry وأعمدة CaseStage الانتقالية
- **السياق:** في المرحلة 2 خُزّن `first_hearing_date` و `first_postponement_reason` على `CaseStage` كحقلين انتقاليين (D-020) لانتظار ظهور `HearingProgressionEntry`.
- **التفسير المعتمد للترحيل في المرحلة 3:**
  1. Migration `V11__backfill_initial_progression.sql` يُنشئ entry واحدة بنوع `INITIAL` لكل `case_stage` موجودة، مأخوذة من `first_hearing_date` (يصبح `hearing_date`) و `first_postponement_reason` (يصبح `postponement_reason_label` كنص حرفي).
  2. `postponement_reason_code` في الـ entries المُرحَّلة = `NULL` لأن نصوص Phase 2 كانت حرة وغير مربوطة بالقائمة المعيارية.
  3. **بعد الترحيل تبقى الأعمدة في الـ DB كأرشيف** ولا تُحذف، لكن:
     - APIs الجديدة لا تقرأها ولا تكشفها.
     - منطق الترحيل/التاريخ يعتمد حصريًا على `HearingProgressionEntry`.
     - تحديث `firstHearingDate / firstPostponementReason` عبر `PUT /cases/{id}/basic-data` يبقى ممكنًا تقنيًا في Phase 3 لكنه **deprecated** ولا يُترجم إلى entry جديدة (لا حذف API هنا تجنبًا لكسر العقد).
  4. حذف الأعمدة الفعلي يُؤجَّل لمرحلة لاحقة بعد ضمان عدم وجود مستهلك.
- **القيد:**
  - أي entry جديدة (Phase 3+) من نوع `INITIAL` أو `ROLLOVER` **يجب** أن تحمل `postponement_reason_code` مرجعًا إلى `postponement_reasons`. تُرفض القيمة فارغة.
  - entries النوع `FINALIZED` لا تتطلب `postponement_reason_code`.

## D-023: حدود الوحدات بين litigationregistration ⇄ litigationprogression ⇄ decisionfinalization
- **السياق:** الوحدتان الجديدتان (progression, finalization) تحتاجان قراءة/تعديل حقول على `CaseStage` (التي تعيش في litigationregistration).
- **التفسير المعتمد:**
  - Port جديد `CaseStagePort` في `litigationregistration.application` يعرض:
    - `Optional<StageInfo> find(stageId)`
    - `void markInProgress(stageId)`
    - `void markFinalized(stageId, Instant endedAt)`
  - Adapter `CaseStagePortAdapter` في `litigationregistration.infrastructure` يُنفّذها مع `CaseStageRepository`.
  - **لا يجوز** لأي وحدة أخرى الوصول إلى `CaseStageRepository` مباشرة.
  - استدعاءات Application↔Application مسموحة (مثلاً `DecisionFinalizationService` يستدعي `HearingProgressionService.appendInternal(...)` لإلحاق entry من نوع `FINALIZED`).
- **القيد:** أي وحدة جديدة لاحقة تحتاج كتابة على `CaseStage` تمر عبر `CaseStagePort` فقط؛ لا يُسمح بإضافة set methods جديدة على الـ port دون تحديث هذا القرار.

## D-024: السلطة على rollover-hearing و finalize محصورة بالمحامي المُسنَد
- **السياق:** الوظيفية §6.5 و §7 تجعل ترحيل الجلسات والفصل ضمن مسؤولية المحامي المُسنَد. الوثيقتان لا تذكران استثناءً صريحًا لرئيس القسم في هذه العمليات اليومية.
- **التفسير المعتمد:**
  - `POST /api/v1/stages/{stageId}/rollover-hearing` و `POST /api/v1/stages/{stageId}/finalize` تتطلبان أن يكون `actor.userId == case.currentOwnerUserId` عبر `AuthorizationService.requireCaseOwnership`.
  - **لا استثناء** لرئيس القسم أو الموظف الإداري أو المركزي في هذه المرحلة. أي تخويل استثنائي مستقبلي = قرار جديد D-025+ مع نص واضح من الزبون.
  - القراءة (`GET /stages/...`) تخضع لـ D-021 العادية وليست محصورة بالمالك.

## D-025: سجل الفصل (resolved-register) — Read Model مشتق بدون projection table
- **السياق:** الوظيفية §8 توصِّف سجل الفصل الشهري كعرض مجمَّع للقضايا المفصولة. التقنية §5.3 تجعل `CaseDecision` مصدر الحقيقة للفصل. الوثيقتان لا تفرضان وجود جدول projection منفصل.
- **التفسير المعتمد:**
  - وحدة `resolvedregister` **Read Model فقط** بدون أي جدول جديد ولا أعمدة مشتقة.
  - الاستعلام يُنفَّذ عبر `NamedParameterJdbcTemplate` كـ native SQL يجمع بين `litigation_cases` و `case_stages` و `case_decisions` (الجداول الثلاثة) ويرشّح بـ `EXTRACT(YEAR/MONTH FROM decision_date)` + `branchId` + `departmentId` + `decisionType`.
  - **لا duplicated truth**: حذف/تعديل أي `CaseDecision` (لا يحدث فعليًا لأنها append-only) ينعكس فورًا على السجل.
  - **لا CaseFinalizedEvent consumer** في هذه المرحلة. الحدث يبقى منشورًا بلا مستهلك (محجوز للمراحل القادمة: notifications/audit).
  - أي حاجة مستقبلية لـ projection table (للأداء على ملايين السجلات) ستكون قرارًا جديدًا D-028+ مع تبرير قياسي.
- **القيد:**
  - الاستعلام يحترم scope القراءة الموثَّق في D-021 (يُحقن في WHERE clause بناءً على `AuthorizationContext`).
  - أي وحدة لاحقة لا تستخدم `resolvedregister` كمصدر كتابة — لا توجد APIs كتابة فيها أصلًا.

## D-026: شرط ترقية الاستئناف — لا قيد على `decisionType`
- **السياق:** الوثيقتان لا تنصّان صراحةً على شرط نوع قرار محدد للترقية إلى الاستئناف. عمليًا تُستأنف عادةً قرارات `AGAINST_ENTITY` و `NON_FINAL`، أما `FOR_ENTITY` فيستأنفها الخصم خارج النظام، و `SETTLEMENT` غير قابل للاستئناف منطقيًا — لكن **لا نص صريح** بذلك في المرجعية.
- **التفسير المعتمد (Conservative — لا قيود غير منصوصة):**
  - الترقية إلى الاستئناف تتطلب **فقط**:
    1. وجود الدعوى ومرحلتها الحالية.
    2. `current_stage.stage_status = FINALIZED` (وإلا 400 `STAGE_NOT_FINALIZED` — لا معنى لاستئناف مرحلة لم تُفصَل).
    3. `current_stage.stage_type ≠ APPEAL` (وإلا 400 `ALREADY_APPEAL_STAGE` — لا توجد محكمة أعلى في النموذج).
    4. `current_stage.is_read_only = false` (وإلا 409 `STAGE_ALREADY_PROMOTED`).
    5. `LitigationCase.lifecycle_status ∈ {NEW, ACTIVE}` (وإلا 409 `INVALID_LIFECYCLE_FOR_APPEAL`).
  - **لا فلتر على `decisionType`**. ترك القرار للمستخدم التشغيلي. أي تقييد مستقبلي = قرار جديد D-028+ مع نص صريح من الزبون.
- **القيد:** اختبار التكامل يتحقق فقط من القيود الخمسة أعلاه ولا يدّعي أي قيد على `decisionType`.

## D-027: تفويض جديد `PROMOTE_TO_APPEAL` للموظف الإداري
- **السياق:** الترقية للاستئناف عملية إدارية تخرج عن العمل اليومي للمحامي (D-024 خاصة بـ rollover/finalize فقط). تنتمي طبيعيًا لـ SECTION_HEAD، مع إمكانية تفويضها للموظف الإداري (D-004).
- **التفسير المعتمد:**
  - إضافة قيمة جديدة `PROMOTE_TO_APPEAL` إلى enum `DelegatedPermissionCode`.
  - الصلاحية على `POST /cases/{caseId}/promote-to-appeal`:
    - `SECTION_HEAD` لقسم الدعوى → مسموح دائمًا.
    - `ADMIN_CLERK` لقسم الدعوى مع `PROMOTE_TO_APPEAL = granted=true` → مسموح.
    - أي دور آخر بما فيهم المحامي المُسنَد → 403.
  - يُستهلك عبر `AuthorizationService.requireCaseManagement(actor, branch, dept, PROMOTE_TO_APPEAL)` (نفس النمط المستخدم في `CREATE_CASE` / `EDIT_CASE_BASIC_DATA` / `ASSIGN_LAWYER`).
- **القيد:** لا حاجة لـ DB migration — `permission_code` في V3 مُعرَّف `VARCHAR(64)` بدون CHECK constraint، فالقيمة الجديدة تُخزَّن مباشرة.

## D-028: ExecutionFile و ExecutionStep ككيانين JPA مستقلين
- **السياق:** Phase 5. التنفيذ مسار مستقل (D-003) لا CaseStage ولا HearingProgressionEntry.
- **التفسير المعتمد:**
  - يُنشأ كيان JPA `ExecutionFile` على جدول `execution_files` مرتبط بـ `litigation_case_id` و `source_stage_id` (المرحلة المُرَقَّاة منها)، مع snapshot نصي للأطراف ورقم/سنة الملف، وحالة `OPEN/IN_PROGRESS/CLOSED/ARCHIVED`، وفهارس على case + (branch,dept) + assigned_user + status + source_stage.
  - يُنشأ كيان JPA `ExecutionStep` على جدول `execution_steps` للخطوات المؤرَّخة، مرتبطًا بـ `execution_file_id`، append-only كاملًا (D-031).
  - مفتاح فريد `(branch_id, execution_year, execution_file_number)` يضمن عدم تكرار رقم الملف ضمن الفرع/السنة.
- **المبرر:** التنفيذ ليس CaseStage (D-003) ولا يحوي جلسات؛ يحتاج جدولين مستقلين بـ FK واضح إلى LitigationCase + sourceStageId. لا duplicated truth.
- **القيد:** لا علاقات JPA `@ManyToOne` بين الجدولين والكيانات الأخرى — الربط بـ FK نقي بقيم Long، اتساقًا مع نمط Phase 2/3.

## D-029: قيود ترقية إلى التنفيذ — Conservative
- **السياق:** Phase 5. الوثائق صامتة عن قيد `decisionType` أو `stage_type` لترقية التنفيذ.
- **التفسير المعتمد:** قائمة قيود محافِظة فقط:
  1. `current_stage.stage_status == FINALIZED` — وإلا 400 `STAGE_NOT_FINALIZED`.
  2. `!current_stage.is_read_only` — وإلا 409 `STAGE_ALREADY_PROMOTED`.
  3. `lifecycle_status ∈ {ACTIVE, IN_APPEAL}` — وإلا 409 `INVALID_LIFECYCLE_FOR_EXECUTION`.
  4. وجود قسم EXECUTION ضمن نفس فرع الدعوى — وإلا 409 `NO_EXECUTION_DEPARTMENT_IN_BRANCH` (D-033).
  5. تفرّد `(branch_id, execution_year, execution_file_number)` — وإلا 409 `EXECUTION_FILE_NUMBER_DUPLICATE`.
- **لا قيد على `decisionType`** (مرآة موقف D-026): الوثائق لا تثبت اشتراط `FOR_ENTITY` صراحةً، فلا نُدخِله افتراضيًا. أي تقييد إضافي يحتاج قرارًا جديدًا D-035+.
- **لا قيد على `stage_type`**: يُسمح من CONCILIATION/FIRST_INSTANCE/APPEAL طالما `FINALIZED`.
- **القيد:** هذه قائمة دنيا غير قابلة للتقليص. أي زيادة قيود تكون قرارًا جديدًا.

## D-030: تفويضان جديدان `PROMOTE_TO_EXECUTION` و `ADD_EXECUTION_STEP`
- **السياق:** Phase 5. الموظف الإداري يحتاج تفويضًا صريحًا لإجراء التنفيذ والإضافة على ملفه (مرآة D-027).
- **التفسير المعتمد:**
  - يُضاف رمزان جديدان إلى enum `DelegatedPermissionCode`: `PROMOTE_TO_EXECUTION` و `ADD_EXECUTION_STEP`.
  - الصلاحية على `POST /cases/{caseId}/promote-to-execution`:
    - `SECTION_HEAD` لقسم الدعوى → مسموح دائمًا.
    - `ADMIN_CLERK` لقسم الدعوى مع `PROMOTE_TO_EXECUTION = granted=true` → مسموح.
    - أي دور آخر (بما فيهم المحامي ولو كان مالكًا) → 403.
  - الصلاحية على `POST /execution-files/{id}/steps`:
    - `SECTION_HEAD` لقسم الملف → مسموح.
    - `ADMIN_CLERK` لقسم الملف مع `ADD_EXECUTION_STEP = granted=true` → مسموح.
    - `assigned_user_id == actorUserId` (المُسنَد إلى الملف، عادةً المحامي السابق) → مسموح.
    - أي دور آخر → 403.
- **القيد:** لا migration (نفس مبرر D-027).

## D-031: ExecutionStep append-only (مرآة D-022)
- **السياق:** Phase 5. الخطوات التنفيذية سجل تاريخي لا يُعدَّل ولا يُحذف.
- **التفسير المعتمد:** أربع طبقات إكراه مماثلة لـ HearingProgressionEntry:
  1. **Domain JPA:** كل عمود `@Column(updatable=false)`، بدون `@Setter`، بناء عبر `@Builder` فقط.
  2. **Repository:** `ExecutionStepRepository` يُستخدم فقط لـ `save` (إنشاء) و `findByExecutionFileIdOrderByStepDateAscIdAsc` و `countByExecutionFileId`. لا استدعاء لـ `delete*` أو `saveAll(updates)` في أي مكان.
  3. **API:** لا `PUT /steps/{id}` ولا `DELETE`.
  4. **Test:** `ExecutionStepAppendOnlyUnitTest` + `ExecutionApiIT.test8_noUpdateOrDeleteOnSteps`.
- `ExecutionStepType` enum مغلقة مبدئيًا: `NOTICE_REQUEST, NOTICE_ISSUED, SEIZURE_REQUEST, SEIZURE_PLACED, PAYMENT_RECORDED, ADMIN_ACTION, CLOSURE, OTHER` — مع DB CHECK مطابق. التحويل إلى Reference Table = قرار جديد لاحقًا.
- **القيد:** لا DB-level trigger في Phase 5 — الطبقات 1–4 كافية لـ MVP. أي إضافة trigger = D-035+.

## D-032: Read scope على execution_files
- **السياق:** Phase 5. مرآة D-021/D-025 مع فرق ownership.
- **التفسير المعتمد:** نفس منطق `ResolvedRegisterService.buildScope`:
  - `CENTRAL_SUPERVISOR / READ_ONLY_SUPERVISOR / SPECIAL_INSPECTOR` → ALL.
  - `BRANCH_HEAD` → `branch_id IN headBranches`.
  - `SECTION_HEAD / ADMIN_CLERK` → `(branch_id, department_id) IN memberships`.
  - `STATE_LAWYER` → `assigned_user_id = me`.
  - وإلا → NONE.
  Precedence: BRANCH_HEAD > SECTION_HEAD/CLERK > LAWYER.
- **الفرق عن D-025:** ownership في مسار التنفيذ يستند إلى `execution_files.assigned_user_id` (وليس `litigation_cases.current_owner_user_id`)، لأن `current_owner_user_id` يُنزع إلى `null` أثناء الترقية (D-024 + D-034).
- **القيمة الأولية لـ `assigned_user_id`** عند الإنشاء = `previousOwnerUserId` للمرحلة المُرَقَّاة إن وُجد، وإلا `null`. تغيير الإسناد لاحقًا يحتاج endpoint جديد = قرار جديد D-035+.
- **القيد:** المُحقَّق على السجل المفرد (GET) عبر `scope.matches(branch, dept, assignedUser)`؛ المُحقَّق على القائمة عبر JPA Specification يُحقَن في WHERE.

## D-033: قسم EXECUTION ضمن نفس فرع الدعوى
- **السياق:** Phase 5. كل ملف تنفيذي يُنشأ في قسم EXECUTION من نفس الفرع الذي بدأت فيه الدعوى الأصلية.
- **التفسير المعتمد:** عند `promote-to-execution` يستعلم `ExecutionService` عن قسم EXECUTION للفرع عبر `OrganizationService.findDepartment(branchId, EXECUTION)`. غياب القسم → 409 `NO_EXECUTION_DEPARTMENT_IN_BRANCH` (لا fallback تلقائي).
- **المبرر:** البذور (V4/V5) تُنشئ قسم EXECUTION ودائرة تنفيذ لكل فرع؛ لا حاجة لاختيار يدوي.
- **القيد:** لا يُسمح بنقل ملف تنفيذي بين فروع. تغيير الفرع يحتاج قرارًا جديدًا.

## D-034: `current_stage_id` و lifecycle بعد promote-to-execution
- **السياق:** Phase 5. كيف نمثّل الدعوى بعد ترقيتها إلى التنفيذ؟
- **التفسير المعتمد:**
  - `LitigationCase.lifecycle_status = IN_EXECUTION`.
  - `LitigationCase.current_owner_user_id = null` (يُنقل المالك المنطقي إلى `ExecutionFile.assigned_user_id`).
  - `LitigationCase.current_stage_id` **يبقى يشير إلى المرحلة السابقة** (التي صارت `read_only=true` و `PROMOTED_TO_EXECUTION`) كمرجع تاريخي للقراءة.
  - **لا تُنشأ CaseStage جديدة** (مغاير لمسار الاستئناف D-002).
- **المبرر:** التنفيذ ليس مرحلة قضائية (D-003)؛ إنشاء CaseStage جديدة من نوع EXECUTION يكسر هذا الفصل ويُدخل تكرارًا. الإبقاء على `current_stage_id` يعطي القراءة معنىً تاريخيًا متَّسقًا.
- **القيد:** لا rollover/finalize بعد الترقية على المرحلة السابقة (مرآة D-024). التنفيذ يُدار حصرًا عبر `execution_steps` و(لاحقًا) endpoint إغلاق الملف التنفيذي.

## D-035: استراتيجية تخزين المرفقات — local filesystem في Phase 6
- **السياق:** Phase 6. المرفقات تحتاج طبقة تخزين، لكن لا يوجد object storage مُجهَّز (S3/MinIO) في بيئة الإصدار الأول.
- **التفسير المعتمد:**
  - تُعرَّف واجهة `AttachmentStoragePort` في `attachments.application` بثلاث عمليات: `store`, `open`, `size`.
  - يُنفَّذ `LocalFilesystemAttachmentStorage` في `attachments.infrastructure` يحفظ تحت مجلد قابل للضبط `sla.attachments.base-dir` (افتراضي `./attachments-data`).
  - شكل `storage_key` = `{yyyy}/{MM}/{uuid}__{sanitized_filename}`، مع تنظيف اسم الملف ومنع path-traversal.
  - حد أقصى للحجم في Phase 6: **50MB** لكل مرفق (يُرفض > 50MB بـ 400 `FILE_TOO_LARGE`). يمكن تعديله بقرار جديد إن لزم.
  - يُحسب `checksum_sha256` لكل ملف ويُخزَّن (للمساعدة في التحقق المستقبلي).
- **القيد:**
  - في الإنتاج بـ multiple instances يجب استبدال الـ adapter بـ S3/MinIO (لكن الـ Port نفسه يبقى).
  - لا backup/replication ضمن Phase 6.
  - لا scanning أمني (anti-virus) — يُؤجَّل لقرار لاحق.

## D-036: قواعد صلاحيات المرفقات
- **السياق:** Phase 6. ربط صلاحيات الرفع/القراءة بـ scope الأصل (مرحلة قضائية/ملف تنفيذي/خطوة تنفيذية).
- **التفسير المعتمد:**
  - **القراءة (`list` و `download`)**:
    - `CASE_STAGE` و scope الدعوى ⇒ نفس قواعد D-021 (`AuthorizationService.requireReadAccessToCase`).
    - `EXECUTION_FILE` ⇒ نفس قواعد D-032 (`ExecutionScope.matches`).
    - `EXECUTION_STEP` ⇒ يُحال إلى ملفه الأب ثم نفس قواعد `EXECUTION_FILE`.
  - **الرفع (`upload`)** — أكثر صرامة من القراءة:
    - `CASE_STAGE`: `SECTION_HEAD` أو `ADMIN_CLERK` لقسم/فرع المرحلة، أو المحامي المالك (`current_owner_user_id == actor`). أدوار الإشراف (BRANCH_HEAD/CENTRAL/READ_ONLY/SPECIAL) **لا** ترفع.
    - `EXECUTION_FILE` (و `EXECUTION_STEP`): `SECTION_HEAD` أو `ADMIN_CLERK` لقسم/فرع الملف، أو `assigned_user_id == actor`.
  - `attachment_scope_type` enum مغلقة بثلاث قيم (CASE_STAGE/EXECUTION_FILE/EXECUTION_STEP)، مع DB CHECK.
- **القيد:**
  - لا `DELETE`/`PUT` في Phase 6.
  - عمود `is_active` متاح للاستخدام المستقبلي (soft-deactivation) لكن لا API يستخدمه الآن.
  - `download` يفحص الصلاحية قبل فتح الـ stream؛ لا تسريب لأي بايت خارج النطاق.

## D-037: التذكيرات شخصية — مالك حصري (منشئ التذكير)
- **السياق:** Phase 6. الوظيفية تذكر التذكيرات كأداة عمل للمستخدم، الوثائق لا تنص على shared reminders.
- **التفسير المعتمد:**
  - كل `Reminder` له `owner_user_id = منشئه`.
  - **الإنشاء/القراءة** يتطلبان أن يكون المستخدم ضمن read-scope الدعوى (D-021)، لكن **القراءة محصورة بتذكيرات المستخدم نفسه فقط**: `findByLitigationCaseIdAndOwnerUserIdOrderByReminderAtAsc`.
  - **تحديث الحالة** (`PATCH /reminders/{id}/status`) محصور بمالك التذكير حصريًا. أي مستخدم آخر (حتى لو ضمن نطاق الدعوى) → 403.
  - دورة حياة الحالة محصورة: `PENDING → DONE` أو `PENDING → CANCELLED`. لا re-open بعد DONE/CANCELLED → 400 `INVALID_TRANSITION`.
  - shared reminders / تذكيرات للقسم كله = قرار جديد لاحقًا.
- **القيد:** لا scheduler / due-notification في Phase 6 (D-039). التذكيرات تُقرأ فقط عبر REST.

## D-038: مستلمو الإشعارات — قائمة محافِظة
- **السياق:** Phase 6 + D-010 + D-016. الوظيفية §12 تطلب إشعارات أساسية دون إغراق.
- **التفسير المعتمد:** مستهلكان فقط في Phase 6:
  - **`CaseRegisteredEvent` ⇒ `CASE_REGISTERED` notification** لكل من:
    - أعضاء `SECTION_HEAD` النشطين في `(branchId, departmentId)` للدعوى.
    - أعضاء `ADMIN_CLERK` النشطين في نفس `(branchId, departmentId)`.
    - المحامي المُسنَد عند الإنشاء إن وُجد (`initialOwnerUserId`).
    - **لا يُشعَر** `BRANCH_HEAD` ولا `CENTRAL_SUPERVISOR` ولا أي دور إشرافي آخر (مرآة D-016).
  - **`LawyerAssignedEvent` ⇒ `LAWYER_ASSIGNED` notification** للمحامي المُسنَد فقط.
- **القيد:**
  - **لا** يُولَّد إشعار في Phase 6 لـ `CasePromotedToAppealEvent` ولا لـ `CasePromotedToExecutionEvent` ولا لـ `ExecutionStepAddedEvent` ولا لـ `CaseFinalizedEvent` — اختيار محافظ. أي إضافة = قرار جديد D-040+.
  - الإشعار يُنشأ في معاملة منفصلة (`REQUIRES_NEW`) ليُعزل أي فشل عن العملية الأصلية.
  - لا `POST` API لإنشاء إشعار يدويًا — الإنشاء حصري للمستهلكين الداخليين.
  - `GET /notifications` يُرجع فقط إشعارات `recipient_user_id == actorUserId`.
  - `PATCH /notifications/{id}/read` يُرفض على إشعار مستخدم آخر (403).

## D-039: لا scheduler / لا قنوات خارجية في Phase 6
- **السياق:** Phase 6 يحتاج وضوحًا لما هو خارج النطاق لتجنب التضخم.
- **التفسير المعتمد:** ممنوع في Phase 6:
  - **Reminder due scheduler** (لا background job يحوّل التذكيرات إلى إشعارات عند `reminder_at`).
  - **Email/SMS/Push integration** (لا قنوات خارج التطبيق — مرجع D-013).
  - **WebSocket / SSE / realtime delivery**.
  - **Attachment versioning / DELETE / soft-delete API**.
  - **Notification batching / digest**.
  - **Anti-virus scanning** للمرفقات.
  - أي UI.
- **القيد:** كل عنصر مما سبق = قرار جديد عند الحاجة.

## D-021: نطاق قراءة الدعاوى (read-scope filtering)
- **السياق:** الوظيفية §3.1–3.7 + §4 تُحدّد نطاقات الرؤية لكل دور؛ يلزم ترجمتها إلى استعلام DB لـ `GET /cases` و `GET /cases/{id}`.
- **التفسير المعتمد:** المنطق المُطبَّق على القراءة:
  - `CENTRAL_SUPERVISOR` / `READ_ONLY_SUPERVISOR` / `SPECIAL_INSPECTOR`: كل الدعاوى.
  - `BRANCH_HEAD`: حيث `created_branch_id` ضمن الفروع التي يرأسها.
  - `SECTION_HEAD` / `ADMIN_CLERK`: حيث `(created_branch_id, created_department_id)` ضمن عضوياته الفعّالة.
  - `STATE_LAWYER`: فقط حيث `current_owner_user_id = me` (تطبيق صريح لقاعدة ملكية المحامي §4.1).
  - أي مستخدم خارج هذه الأدوار → نتيجة فارغة.
- **القيد:** المشرف الخاص (SPECIAL_INSPECTOR) يُعطى افتراضيًا نطاقًا عامًا في هذه المرحلة؛ تقييده بفرع محدد عند الحاجة يحدث عبر عدم منحه الدور وإنما إعطاؤه `READ_ONLY_SUPERVISOR` مع عضويات BRANCH_HEAD على الفرع المسموح. سيُعاد تقييم ذلك في مراحل لاحقة إن لزم.

## D-040: نموذج بسيط لوحدات Phase 7 (مكتبة قانونية / دليل جهات / تعاميم)
- **السياق:** Phase 7 — تعليمات صريحة بإبقاء النموذج بسيطًا وقابلًا للبحث، بدون CMS أو workflow.
- **التفسير المعتمد:** ثلاث وحدات backend جديدة بالطبقات المعتادة:
  - `legallibrary`: كيانان `LegalCategory` (هرمي عبر `parent_id`) و`LegalLibraryItem`.
  - `publicentitydirectory`: كيانان `PublicEntityCategory` و`PublicEntityItem`.
  - `circulars`: كيان واحد `Circular` + enum `CircularSourceType` محصور بـ `MINISTRY_OF_JUSTICE` و `STATE_LITIGATION_ADMINISTRATION` (DB CHECK).
  - الفئات في الوحدتين الهرميتين تستخدم `code` فريدًا و`sort_order` للعرض.
  - عناصر المكتبة تُخزِّن `published_at` (DATE)، التعاميم تخزن `issue_date` (DATE) و`reference_number` و`source_type`.
  - جميع العناصر تحمل `is_active`, `created_at`, `updated_at`.
- **القيود:**
  - **لا** versioning، **لا** approval workflow، **لا** rich-content builder.
  - **لا** تعريف موحَّد لـ "fulltext" — يُكتفى بـ `keywords` نصي حر.
  - **لا** ربط هرمي إلزامي إن لم يَرِد `parent_id`.
  - أي توسعة (مصادر تعميم جديدة، حقول إضافية، CRUD إداري) = قرار جديد D-043+.

## D-041: استراتيجية البحث في Phase 7 = JPA Specifications + ILIKE
- **السياق:** برومبت Phase 7 ينص على "بحث نصي بسيط" و"حل بسيط وواضح باستخدام JPA/specification أو query".
- **التفسير المعتمد:**
  - بحث `q` يُحوَّل إلى نمط `%term%` بعد `lower(trim(q))` ويُطابَق على عدة أعمدة نصية للوحدة (مع `coalesce(...,'')` للأعمدة nullable):
    - `legallibrary/items` → `title / summary / body_text / keywords`.
    - `publicentitydirectory/items` → `name_ar / short_description / details_text / keywords`.
    - `circulars` → `title / summary / body_text / keywords / reference_number`.
  - فلاتر الفئة/الحالة/المصدر/التاريخ تُبنى عبر `Specification` متراكمة بـ AND.
  - `issueDateFrom > issueDateTo` ⇒ `400 INVALID_DATE_RANGE`.
  - الترتيب الافتراضي يُحدَّد لكل وحدة (مكتبة وتعاميم: `published_at/issue_date` تنازليًا؛ جهات: `id` تصاعديًا).
  - حدود pagination: `size` افتراضي 20، أقصى 100، `page` ≥ 0.
- **القيود:**
  - **لا** PostgreSQL `tsvector`/GIN ولا extensions، **لا** Elastic.
  - فهارس مضافة فقط `LOWER(title)` / `LOWER(name_ar)` لمساعدة ILIKE — كافية للحجم المتوقع لـ Phase 7.
  - أي ترقية لمحرك بحث متقدم = D-043+ لاحقًا، دون كسر شكل الـ APIs الحالية.

## D-042: صلاحية القراءة في Phase 7 = أي مستخدم مصادق عليه
- **السياق:** برومبت Phase 7 ينص: "اجعل هذه الوحدات قرائية فقط على مستوى الـ APIs العامة" + قائمة أدوار شاملة (CENTRAL_SUPERVISOR, BRANCH_HEAD, SECTION_HEAD, ADMIN_CLERK, STATE_LAWYER, READ_ONLY_SUPERVISOR, SPECIAL_INSPECTOR).
- **التفسير المعتمد:**
  - APIs Phase 7 تتحقق فقط من `SecurityUtils.currentUserOrThrow()` ⇒ أي مستخدم لديه JWT صالح يستطيع القراءة.
  - **لا** فلترة scope إضافية ولا استخدام `AuthorizationService` لهذه الوحدات (لا توجد ملكية ولا فرع/قسم لها).
  - **لا** write APIs أبدًا في Phase 7. أي إنشاء/تعديل = D-043+ مع تحديد دقيق للأدوار.
  - مستخدم غير مصادق ⇒ `401 UNAUTHORIZED` (تعامل عام للـ `SecurityFilterChain` الحالي).
- **القيود:**
  - حال احتاج المنتج لاحقًا تقييد الوصول لبعض الفئات (مثلاً «اجتهادات سرية»)، يلزم قرار جديد يضيف صلاحية مفصّلة، ولا يُسمح بحقن منطق scope صامت.
  - بقاء هذه الوحدات «مكتبة معرفية مفتوحة لكل مستخدمي النظام» = افتراض أساسي لسهولة استخدامها.

---

## D-043..D-045 (Frontend foundation — Phase 8) — مرجع
- D-043, D-044, D-045 سُجِّلت أصلًا في وثائق الواجهة الأمامية (انظر
  `docs/project-ui/UI_FOUNDATION_PHASE8.md`) وتُلخَّص هنا لمنع الانجراف
  التوثيقي:
  - **D-043:** Stack الواجهة ثابت = React 18 + TS + Vite + Router v6 +
    TanStack Query + Axios + RHF + Zod + Tailwind. لا تغييرات بدون قرار
    جديد.
  - **D-044:** التوكن يُحفظ في `localStorage` خلف Port (`tokenStorage`).
    التحوّل إلى httpOnly cookies = قرار D-049+ موثَّق + Phase ops.
  - **D-045:** Navigation محصور بالعناصر المعتمدة في
    `UI_NAVIGATION_MODEL.md`. أي عنصر جديد = قرار/إضافة موثَّقة في وثيقة
    Phase الأمامية الموافقة.

---

## D-046: Mini-Phase A — `GET /api/v1/users` للـ Assign Lawyer
- **السياق:** Phase 11 لم تستطع بناء UI الإسناد لعدم وجود endpoint يكشف
  المحامين المؤهَّلين (`BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md`). تنفيذ
  Mini-Phase A أغلق الـ gap ويستلزم تثبيت العقد.
- **القرار المعتمد:**
  - Endpoint جديد read-only واحد فقط:
    `GET /api/v1/users?branchId&departmentId&membershipType=STATE_LAWYER&activeOnly=true`.
  - Response: مصفوفة من `AssignableLawyerDto = { id, fullName, username, active }`
    فقط. **ممنوع** إضافة `mobileNumber` أو `delegatedPermissions` أو
    أي memberships أو timestamps.
  - `branchId` و `departmentId` معلمتان إجباريتان ⇒ غيابهما = `400 MISSING_PARAMETER`.
  - `membershipType` افتراضيًا = `STATE_LAWYER`؛ في Mini-Phase A **لا يُقبل**
    أي قيمة أخرى ⇒ `400 UNSUPPORTED_MEMBERSHIP_TYPE`. أي توسعة لاحقة
    (مثلاً السماح بقيم أخرى لاستعراضات إدارية) تستلزم قرارًا جديدًا
    D-047+ ضمن Mini-Phase B.
  - `activeOnly` افتراضيًا = `true` ويُفلتر بـ `users.is_active`.
  - Authorization محافظ:
    - `SECTION_HEAD` بعضوية فعّالة في `(branchId, departmentId)` ⇒ مسموح.
    - `ADMIN_CLERK` بعضوية فعّالة في `(branchId, departmentId)` **ومع
      تفويض `ASSIGN_LAWYER`** ⇒ مسموح.
    - أي دور آخر (CENTRAL_SUPERVISOR، BRANCH_HEAD، READ_ONLY_SUPERVISOR،
      SPECIAL_INSPECTOR، STATE_LAWYER، ADMIN_CLERK بدون التفويض، …) ⇒
      `403`. هذه القائمة ضيقة عمدًا لمنع تحويل الـ endpoint إلى
      Users-Admin lookup.
  - الترتيب: `fullName ASC`.
- **القيود:**
  - هذا الـ endpoint **ليس** نقطة دخول لإدارة المستخدمين. إنشاء
    المستخدمين/الأدوار/العضويات/التفويضات يبقى موثَّقًا في
    `BACKEND_GAP_PHASE11_USER_ADMIN.md` ولا يُنفَّذ إلا في Mini-Phase B
    بقرارات منفصلة (D-047, D-048+).
  - الواجهة المرافقة (`AssignLawyerSection` + استبدال `#userId` بأسماء
    عبر `lawyerLabel`) visual-only؛ الخادم يبقى السلطة الفصلية.
  - لا تعديل لعقد `POST /cases/{id}/assign-lawyer` القائم.
  - أي تغيير لشكل `AssignableLawyerDto` أو لقواعد الصلاحية = قرار جديد
    D-047+.

---

## D-047: Mini-Phase B — سياسة كلمة المرور الأولية لإنشاء المستخدمين
- **السياق:** Mini-Phase B تفتح `POST /api/v1/users` لـ `CENTRAL_SUPERVISOR`
  لإنشاء مستخدمين جدد. كان لا بد من سياسة واضحة لكلمة المرور الأولية،
  دون توسيع النطاق لخدمات SMS/Email أو لـ workflow on-boarding كامل.
- **القرار المعتمد:**
  - `CreateUserRequest.initialPassword` معامل **إلزامي** في الجسم.
  - الخادم يُلزم: طول ≥ 8 أحرف (Bean Validation) ⇒ `VALIDATION_ERROR`.
  - الخادم يرفض السلسلة الحرفية `ChangeMe!2026` (default الـ
    `BootstrapAdminRunner`) ⇒ `400 WEAK_PASSWORD`.
  - الخادم يخزّن hash بـ BCrypt عبر `PasswordEncoder` نفسه المستخدم في
    bootstrap وفي AuthService، ويعيد فقط `{id}` (بدون كشف كلمة المرور).
  - **التسليم خارج النطاق التقني:** المسؤول الذي أنشأ المستخدم يسلّمه
    اسم المستخدم وكلمة المرور الأولية (شخصيًا أو عبر قناة المنظمة)؛ لا
    قناة SMS/Email تنشأ في Mini-Phase B.
  - **بعدها** يستطيع المستخدم تغيير كلمة المرور عبر مسار `forgot/reset`
    القائم (D-013) — الخادم لا يُجبر على ذلك آليًا في Mini-Phase B.
- **القيود وما هو خارج النطاق:**
  - لا يوجد علم `must_change_password` على كيان `User`، ولا
    Flyway migration، ولا endpoint `change-password`. هذا فجوة موثَّقة
    صراحة في `FINAL_PRODUCTION_BLOCKERS.md` كـ LOW وتُغلَق بقرار
    لاحق D-049+ الذي يضيف العمود + endpoint مخصص + (اختياري) قناة
    تسليم.
  - لا OTP إلزامي لأول دخول، ولا token مؤقت بديل عن كلمة المرور.
  - إعادة تعيين كلمة مرور **مستخدم آخر** بواسطة المسؤول ليست ضمن
    Mini-Phase B (لا `POST /users/{id}/password`)؛ لو لزم لاحقًا فهي
    قرار جديد لأنها تتجاوز قاعدة "Patch user يقتصر على
    active/fullName/mobileNumber" المثبَّتة في الـ gap doc.

## D-048: Mini-Phase B — حدود إدارة الأدوار والعضويات (BRANCH_HEAD لا يُنشئ BRANCH_HEAD)
- **السياق:** فتح APIs لإدارة الأدوار والعضويات يستلزم منع
  «escalation horizontal» حيث يستطيع رئيس فرع إنشاء رئيس فرع آخر
  أو منح صلاحية BRANCH_HEAD لمستخدم آخر، ما يكسر هرم الإدارة المركزية.
- **القرار المعتمد:**
  - `POST /api/v1/users/{id}/roles` و `DELETE /api/v1/users/{id}/roles/{role}`
    محصوران بـ `CENTRAL_SUPERVISOR` فقط في Mini-Phase B.
  - حتى لو وُسِّع نطاق منح الأدوار لاحقًا لأدوار غير مركزية، فإن منح أو
    سحب الدور `BRANCH_HEAD` بالتحديد ممنوع لأي شخص غير
    `CENTRAL_SUPERVISOR` ⇒ يُرفض بـ `403` ورمز خطأ
    **`BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD`** (حارس دفاعي مكرَّر في
    `UserRoleAdminService`).
  - بالمثل في إدارة العضويات: `POST/PATCH /department-memberships`
    تسمح لـ `BRANCH_HEAD` بالعمل على فرعه فقط، **لكن** إنشاء عضوية من
    نوع `MembershipType.BRANCH_HEAD` مطلق ممنوع لأي طرف غير
    `CENTRAL_SUPERVISOR` ⇒ يُرفض بنفس الرمز
    `BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD` (حارس مزدوج: في الكود
    وليس في طبقة قاعدة البيانات).
  - ‘Section head’ في Mini-Phase B لا يستطيع إدارة أي دور؛ يستطيع
    فقط إدارة `delegated permissions` لموظف إداري في قسمه (تأكيد D-004).
- **القيود وما هو خارج النطاق:**
  - لا توسيع لمصفوفة الأدوار لـ `BRANCH_HEAD` في هذه المرحلة. أي تخفيف
    لاحق يستلزم قرارًا جديدًا D-049+ يحترم قاعدة "BRANCH_HEAD لا يُنشئ
    BRANCH_HEAD" المضمنة هنا.
  - لا حذف فعلي للمستخدم في كل الحالات؛ فقط `active=false` (PATCH user).
  - حذف الدور (`DELETE /roles/{role}`) **يحذف فعليًا** سطر `user_roles`
    لأن الكيان لا يحمل علم `active`؛ التغير يُترك للـ DB CASCADE
    القائم. مسار "تجميد دور بدون حذف" خارج النطاق.

---

## Caveats عامة يجب تذكرها
- **لا** تُستخدم أي افتراضات من مشاريع سابقة.
- **لا** يُعتمد README القديم لو وُجد فوق الوثيقتين.
- **لا** تُضاف صلاحيات أو endpoints لم تُذكر في الوثيقتين أو هنا.
- **لا** يُكسر مبدأ "المرحلة السابقة read-only" تحت أي مبرر تشغيلي.
- **لا** يُحوَّل التنفيذ إلى جلسات.
- **لا** يُحوَّل سجل الفصل إلى مصدر حقيقة بديل.
- أي قرار جديد يستوجب إضافته هنا برقم D-xxx جديد.


