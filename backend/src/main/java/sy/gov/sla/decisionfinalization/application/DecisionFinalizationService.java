package sy.gov.sla.decisionfinalization.application;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ConflictException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.decisionfinalization.api.CaseDecisionDto;
import sy.gov.sla.decisionfinalization.api.FinalizeRequest;
import sy.gov.sla.decisionfinalization.domain.CaseDecision;
import sy.gov.sla.decisionfinalization.infrastructure.CaseDecisionRepository;
import sy.gov.sla.litigationprogression.application.HearingProgressionService;
import sy.gov.sla.litigationprogression.domain.EntryType;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.domain.StageStatus;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Transactional
public class DecisionFinalizationService {

    private final CaseDecisionRepository decisionRepo;
    private final CaseStagePort caseStagePort;
    private final HearingProgressionService progressionService; // app↔app call (D-023)
    private final AuthorizationService authorizationService;
    private final ApplicationEventPublisher events;

    public CaseDecisionDto finalize(Long stageId, FinalizeRequest req, Long actorUserId) {
        var info = caseStagePort.find(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));

        if (info.stageStatus() == StageStatus.FINALIZED) {
            throw new ConflictException("STAGE_ALREADY_FINALIZED", "Stage already finalized");
        }
        if (info.readOnly()) {
            throw new BadRequestException("STAGE_READ_ONLY", "Stage is read-only");
        }
        if (decisionRepo.existsByCaseStageId(stageId)) {
            throw new ConflictException("DECISION_EXISTS", "A decision already exists for this stage");
        }
        // Mandatory amount/currency together if provided.
        if ((req.adjudgedAmount() != null) ^ (req.currencyCode() != null)) {
            throw new BadRequestException("AMOUNT_CURRENCY_INCONSISTENT",
                    "adjudgedAmount and currencyCode must be provided together");
        }

        // Ownership: المحامي المُسنَد فقط — D-024.
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireCaseOwnership(actor, info.litigationCaseId());

        Instant now = Instant.now();
        CaseDecision decision = CaseDecision.builder()
                .caseStageId(stageId)
                .decisionNumber(req.decisionNumber())
                .decisionDate(req.decisionDate())
                .decisionType(req.decisionType())
                .adjudgedAmount(req.adjudgedAmount())
                .currencyCode(req.currencyCode())
                .summaryNotes(req.summaryNotes())
                .finalizedByUserId(actorUserId)
                .finalizedAt(now)
                .build();
        decision = decisionRepo.save(decision);

        // Append FINALIZED entry (append-only) قبل تحديث حالة المرحلة.
        progressionService.appendInternal(stageId, EntryType.FINALIZED,
                req.decisionDate(), null, "تم الفصل", actorUserId);

        // Mark stage finalized + endedAt.
        caseStagePort.markFinalized(stageId, now);

        events.publishEvent(new CaseFinalizedEvent(
                info.litigationCaseId(), stageId, decision.getId(),
                decision.getDecisionType(), decision.getDecisionDate(), actorUserId, now));

        UserActionLog.action("finalized case #{} (stage #{}) — decisionType={}, number={}, amount={} {}",
                info.litigationCaseId(), stageId, decision.getDecisionType(), decision.getDecisionNumber(),
                decision.getAdjudgedAmount() == null ? "n/a" : decision.getAdjudgedAmount(),
                decision.getCurrencyCode() == null ? "" : decision.getCurrencyCode());

        return toDto(decision);
    }

    private CaseDecisionDto toDto(CaseDecision d) {
        return new CaseDecisionDto(d.getId(), d.getCaseStageId(), d.getDecisionNumber(),
                d.getDecisionDate(), d.getDecisionType(), d.getAdjudgedAmount(),
                d.getCurrencyCode(), d.getSummaryNotes(), d.getFinalizedByUserId(),
                d.getFinalizedAt());
    }
}

