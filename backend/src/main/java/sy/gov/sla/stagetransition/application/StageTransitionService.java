package sy.gov.sla.stagetransition.application;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.DelegatedPermissionCode;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ConflictException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.litigationregistration.domain.StageType;
import sy.gov.sla.stagetransition.api.PromoteToAppealResponseDto;
import sy.gov.sla.stagetransition.api.PromoteToConciliationResponseDto;

import java.time.Instant;

/**
 * orchestration للترقية إلى الاستئناف. مرجع: D-026 + D-027.
 *
 * الكتابات الذرّية على Case/CaseStage تُفوَّض إلى {@link CaseStagePort#promoteCurrentStageToAppeal}.
 * هذه الخدمة مسؤولة عن: التحقق من الحالة + الصلاحية + نشر الحدث.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class StageTransitionService {

    private final CaseStagePort caseStagePort;
    private final AuthorizationService authorizationService;
    private final ApplicationEventPublisher events;

    public PromoteToAppealResponseDto promoteToAppeal(Long caseId, Long actorUserId) {
        var info = caseStagePort.findCaseWithCurrentStage(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));

        // D-026 — القيود الخمسة فقط، لا قيد على decisionType.
        if (info.currentStageStatus() != StageStatus.FINALIZED) {
            throw new BadRequestException("STAGE_NOT_FINALIZED",
                    "Current stage must be FINALIZED before promoting to appeal");
        }
        if (info.currentStageType() == StageType.APPEAL) {
            throw new BadRequestException("ALREADY_APPEAL_STAGE",
                    "Current stage is already an APPEAL stage; no higher court available");
        }
        if (info.currentStageReadOnly()) {
            throw new ConflictException("STAGE_ALREADY_PROMOTED",
                    "Current stage is read-only (already promoted)");
        }
        if (info.lifecycleStatus() != null
                && info.lifecycleStatus() != LifecycleStatus.NEW
                && info.lifecycleStatus() != LifecycleStatus.ACTIVE) {
            throw new ConflictException("INVALID_LIFECYCLE_FOR_APPEAL",
                    "Case lifecycle does not allow promote-to-appeal: " + info.lifecycleStatus());
        }

        // D-027 — صلاحية SECTION_HEAD أو ADMIN_CLERK مع PROMOTE_TO_APPEAL.
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireCaseManagement(actor, info.branchId(), info.departmentId(),
                DelegatedPermissionCode.PROMOTE_TO_APPEAL);

        // الكتابة الذرّية.
        var newStage = caseStagePort.promoteCurrentStageToAppeal(caseId, actorUserId);

        // PR-8 (C-4): نقرأ معلومات المرحلة الجديدة (الفرع والقسم) لإثرائها على
        // الحدث، حتى يستطيع مستمع الإشعارات إخطار رئيس قسم الاستئناف مباشرة.
        var newStageInfo = caseStagePort.find(newStage.newStageId())
                .orElseThrow(() -> new IllegalStateException(
                        "newly-created appeal stage not found: " + newStage.newStageId()));

        events.publishEvent(new CasePromotedToAppealEvent(
                caseId, newStage.parentStageId(), newStage.newStageId(),
                newStageInfo.branchId(), newStageInfo.departmentId(),
                actorUserId, Instant.now()));

        UserActionLog.action("promoted case #{} to appeal — new stage #{}", caseId, newStage.newStageId());

        return new PromoteToAppealResponseDto(
                caseId, newStage.parentStageId(), newStage.newStageId(),
                LifecycleStatus.IN_APPEAL.name());
    }

    /**
     * Customer feedback round-2: "نقل الملف إلى الصلح".
     * Same gating semantics as promote-to-appeal:
     *   - current stage must be FINALIZED, not already a CONCILIATION stage,
     *     not already read-only/promoted, lifecycle NEW or ACTIVE.
     *   - actor must be SECTION_HEAD of (branch, dept), or ADMIN_CLERK with
     *     the existing PROMOTE_TO_APPEAL delegation (we reuse it rather than
     *     introducing a third delegation code for one button).
     */
    public PromoteToConciliationResponseDto promoteToConciliation(Long caseId, Long actorUserId) {
        var info = caseStagePort.findCaseWithCurrentStage(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));

        if (info.currentStageStatus() != StageStatus.FINALIZED) {
            throw new BadRequestException("STAGE_NOT_FINALIZED",
                    "Current stage must be FINALIZED before transferring to conciliation");
        }
        if (info.currentStageType() == StageType.CONCILIATION) {
            throw new BadRequestException("ALREADY_CONCILIATION_STAGE",
                    "Current stage is already a CONCILIATION stage");
        }
        if (info.currentStageReadOnly()) {
            throw new ConflictException("STAGE_ALREADY_PROMOTED",
                    "Current stage is read-only (already promoted)");
        }
        if (info.lifecycleStatus() != null
                && info.lifecycleStatus() != LifecycleStatus.NEW
                && info.lifecycleStatus() != LifecycleStatus.ACTIVE) {
            throw new ConflictException("INVALID_LIFECYCLE_FOR_CONCILIATION",
                    "Case lifecycle does not allow transfer to conciliation: " + info.lifecycleStatus());
        }

        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        // Reuse PROMOTE_TO_APPEAL delegation for clerks — same trust level.
        authorizationService.requireCaseManagement(actor, info.branchId(), info.departmentId(),
                DelegatedPermissionCode.PROMOTE_TO_APPEAL);

        var newStage = caseStagePort.promoteCurrentStageToConciliation(caseId, actorUserId);

        UserActionLog.action("transferred case #{} to conciliation — new stage #{}",
                caseId, newStage.newStageId());

        return new PromoteToConciliationResponseDto(
                caseId, newStage.parentStageId(), newStage.newStageId(),
                LifecycleStatus.ACTIVE.name());
    }
}

