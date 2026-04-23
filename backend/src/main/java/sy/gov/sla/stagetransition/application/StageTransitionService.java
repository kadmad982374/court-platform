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
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.litigationregistration.domain.StageType;
import sy.gov.sla.stagetransition.api.PromoteToAppealResponseDto;

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

        events.publishEvent(new CasePromotedToAppealEvent(
                caseId, newStage.parentStageId(), newStage.newStageId(),
                actorUserId, Instant.now()));

        return new PromoteToAppealResponseDto(
                caseId, newStage.parentStageId(), newStage.newStageId(),
                LifecycleStatus.IN_APPEAL.name());
    }
}

