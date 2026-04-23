package sy.gov.sla.litigationregistration.application;

import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.litigationregistration.domain.StageType;

import java.time.Instant;
import java.util.Optional;

/**
 * منفذ Port: تستهلكه الوحدات الأخرى (litigationprogression, decisionfinalization,
 * stagetransition, resolvedregister) للوصول إلى CaseStage و LitigationCase
 * دون كسر حدود الوحدات. مرجع: D-023 + D-027.
 */
public interface CaseStagePort {

    Optional<StageInfo> find(Long stageId);

    /** يجلب الدعوى مع المرحلة الحالية في عملية واحدة (لـ stage-transition). */
    Optional<CaseAndCurrentStage> findCaseWithCurrentStage(Long caseId);

    /** يجعل المرحلة في حالة IN_PROGRESS (أول rollover بعد REGISTERED/ASSIGNED). */
    void markInProgress(Long stageId);

    /** يجعل المرحلة FINALIZED ويملأ endedAt. */
    void markFinalized(Long stageId, Instant endedAt);

    /**
     * Promote-to-appeal كعملية ذرية واحدة على ملكية litigationregistration:
     * - يضع المرحلة الحالية read_only=true و stage_status=PROMOTED_TO_APPEAL.
     * - يُنشئ CaseStage جديدة بنوع APPEAL مع parent_stage_id=previous.
     * - يحدّث LitigationCase.current_stage_id و lifecycle_status=IN_APPEAL.
     * - يعيد معلومات المرحلة الجديدة.
     *
     * المنطق التطبيقي (التحقق من الحالة + الصلاحية + الأحداث) يحدث في الخدمة المُستدعية
     * (StageTransitionService)؛ هذا الـ port يقوم بالكتابات فقط بشكل ذرّي.
     *
     * @return معلومات المرحلة الجديدة المُنشأة.
     */
    NewAppealStageInfo promoteCurrentStageToAppeal(Long caseId, Long actorUserId);

    /**
     * Promote-to-execution كتابة ذرّية في وحدة litigationregistration:
     *  - يضع المرحلة الحالية read_only=true و stage_status=PROMOTED_TO_EXECUTION (مع endedAt إن لم يُملأ).
     *  - لا يُنشئ CaseStage جديدة (التنفيذ ليس CaseStage — D-003).
     *  - يضع LitigationCase.lifecycle_status=IN_EXECUTION و current_owner_user_id=null.
     *  - لا يلمس HearingProgressionEntry بتاتًا (مرآة D-022).
     *
     * المنطق التحققي (FINALIZED + غير read-only + lifecycle مناسب) يتم في وحدة execution
     * (ExecutionService) تطبيقًا لـ D-029. هذا الـ port يقتصر على الكتابة الذرّية فقط،
     * مرآة promoteCurrentStageToAppeal.
     *
     * @return معلومات مرحلة المصدر (id) ومعلومات الدعوى الأساسية اللازمة لإنشاء ExecutionFile.
     */
    PromoteToExecutionResult promoteCurrentStageToExecution(Long caseId, Long actorUserId);

    record StageInfo(
            Long stageId,
            Long litigationCaseId,
            StageType stageType,
            Long branchId,
            Long departmentId,
            Long courtId,
            Long assignedLawyerUserId,
            StageStatus stageStatus,
            boolean readOnly,
            Long currentOwnerUserId,
            // Read-scope fallback fields (D-026 / blueprint §9): the section-head /
            // admin-clerk who originated the case must keep visibility on EVERY stage
            // it spawns, even after promote-to-appeal moves the current stage into the
            // APPEAL department. Stage-read endpoints OR these scopes with the stage's
            // own (branchId, departmentId).
            Long caseCreatedBranchId,
            Long caseCreatedDepartmentId
    ) {}

    record CaseAndCurrentStage(
            Long caseId,
            Long branchId,
            Long departmentId,
            Long courtId,
            Long currentStageId,
            StageType currentStageType,
            StageStatus currentStageStatus,
            boolean currentStageReadOnly,
            LifecycleStatus lifecycleStatus,
            Long currentOwnerUserId
    ) {}

    record NewAppealStageInfo(
            Long newStageId,
            Long parentStageId,
            Long caseId
    ) {}

    /**
     * نتيجة promote-to-execution على جانب litigationregistration.
     * لا تُنشأ CaseStage جديدة هنا — هذه القيم تُغذّي وحدة execution لإنشاء ExecutionFile.
     */
    record PromoteToExecutionResult(
            Long caseId,
            Long sourceStageId,
            Long branchId,
            Long departmentId,
            Long previousOwnerUserId
    ) {}
}



