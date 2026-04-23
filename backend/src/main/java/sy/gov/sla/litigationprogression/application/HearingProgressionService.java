package sy.gov.sla.litigationprogression.application;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.litigationprogression.api.*;
import sy.gov.sla.litigationprogression.domain.EntryType;
import sy.gov.sla.litigationprogression.domain.HearingProgressionEntry;
import sy.gov.sla.litigationprogression.domain.PostponementReason;
import sy.gov.sla.litigationprogression.infrastructure.HearingProgressionEntryRepository;
import sy.gov.sla.litigationprogression.infrastructure.PostponementReasonRepository;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.domain.StageStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class HearingProgressionService {

    private final HearingProgressionEntryRepository entryRepo;
    private final PostponementReasonRepository reasonRepo;
    private final CaseStagePort caseStagePort;
    private final AuthorizationService authorizationService;
    private final ApplicationEventPublisher events;

    // ========== Read APIs ==========

    @Transactional(readOnly = true)
    public StageDto getStage(Long stageId, Long actorUserId) {
        var info = caseStagePort.find(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        var actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireReadAccessToStage(actor,
                info.branchId(), info.departmentId(),
                info.caseCreatedBranchId(), info.caseCreatedDepartmentId(),
                info.currentOwnerUserId());
        return new StageDto(info.stageId(), info.litigationCaseId(), info.stageType(),
                info.branchId(), info.departmentId(), info.courtId(),
                info.assignedLawyerUserId(), info.stageStatus(), info.readOnly(), null);
    }

    @Transactional(readOnly = true)
    public List<HearingProgressionEntryDto> getHearingHistory(Long stageId, Long actorUserId) {
        var info = caseStagePort.find(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        var actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireReadAccessToStage(actor,
                info.branchId(), info.departmentId(),
                info.caseCreatedBranchId(), info.caseCreatedDepartmentId(),
                info.currentOwnerUserId());
        return entryRepo.findByCaseStageIdOrderByCreatedAtAsc(stageId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public StageProgressionDto getProgression(Long stageId, Long actorUserId) {
        var info = caseStagePort.find(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        var actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireReadAccessToStage(actor,
                info.branchId(), info.departmentId(),
                info.caseCreatedBranchId(), info.caseCreatedDepartmentId(),
                info.currentOwnerUserId());

        var nonFinalDesc = entryRepo.findLatestNonFinalized(stageId, PageRequest.of(0, 2));
        HearingProgressionEntry current = nonFinalDesc.isEmpty() ? null : nonFinalDesc.get(0);
        HearingProgressionEntry previous = nonFinalDesc.size() < 2 ? null : nonFinalDesc.get(1);

        return new StageProgressionDto(
                stageId, info.litigationCaseId(), info.stageStatus(),
                previous == null ? null : previous.getHearingDate(),
                previous == null ? null : previous.getPostponementReasonCode(),
                previous == null ? null : previous.getPostponementReasonLabel(),
                current == null ? null : current.getHearingDate(),
                current == null ? null : current.getPostponementReasonCode(),
                current == null ? null : current.getPostponementReasonLabel()
        );
    }

    // ========== Write APIs ==========

    public HearingProgressionEntryDto rolloverHearing(Long stageId, RolloverHearingRequest req, Long actorUserId) {
        var info = caseStagePort.find(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        if (info.readOnly()) throw new BadRequestException("STAGE_READ_ONLY", "Stage is read-only");
        if (info.stageStatus() == StageStatus.FINALIZED) {
            throw new BadRequestException("STAGE_FINALIZED", "Stage already finalized");
        }

        // ownership: المحامي المُسنَد فقط (D-024).
        var actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireCaseOwnership(actor, info.litigationCaseId());

        // التحقق من السبب وقائمته المعيارية.
        PostponementReason reason = reasonRepo.findById(req.postponementReasonCode())
                .orElseThrow(() -> new BadRequestException("INVALID_POSTPONEMENT_REASON",
                        "Unknown postponement reason: " + req.postponementReasonCode()));
        if (!reason.isActive()) {
            throw new BadRequestException("INACTIVE_POSTPONEMENT_REASON",
                    "Postponement reason is inactive: " + req.postponementReasonCode());
        }

        // Append-only: ننشئ entry جديدة فقط — لا تعديل لما سبق.
        Instant now = Instant.now();
        HearingProgressionEntry entry = HearingProgressionEntry.builder()
                .caseStageId(stageId)
                .hearingDate(req.nextHearingDate())
                .postponementReasonCode(reason.getCode())
                .postponementReasonLabel(reason.getLabelAr())
                .enteredByUserId(actorUserId)
                .entryType(EntryType.ROLLOVER)
                .createdAt(now)
                .build();
        entry = entryRepo.save(entry);

        // اجعل المرحلة IN_PROGRESS إن كانت REGISTERED/ASSIGNED.
        caseStagePort.markInProgress(stageId);

        // previous: آخر entry قبل الحالية.
        LocalDate prevDate = entryRepo.findLatestNonFinalized(stageId, PageRequest.of(1, 1)).stream()
                .findFirst().map(HearingProgressionEntry::getHearingDate).orElse(null);

        events.publishEvent(new HearingRolledOverEvent(
                stageId, info.litigationCaseId(), entry.getId(), EntryType.ROLLOVER,
                prevDate, entry.getHearingDate(), entry.getPostponementReasonCode(),
                actorUserId, now));

        UserActionLog.action("rolled over hearing on stage #{} of case #{} — next date={}, reason={}",
                stageId, info.litigationCaseId(), entry.getHearingDate(), entry.getPostponementReasonCode());

        return toDto(entry);
    }

    /**
     * Append entry داخلي يُستهلك من DecisionFinalizationService فقط (cross-module application call).
     * مرجع: D-023.
     */
    public HearingProgressionEntry appendInternal(Long stageId, EntryType type,
                                                  LocalDate hearingDate, String reasonCode,
                                                  String reasonLabel, Long actorUserId) {
        Optional<String> codeOpt = Optional.ofNullable(reasonCode);
        // Validate reason code if provided (allowed null for FINALIZED).
        codeOpt.ifPresent(code -> {
            if (!reasonRepo.existsById(code)) {
                throw new BadRequestException("INVALID_POSTPONEMENT_REASON",
                        "Unknown postponement reason: " + code);
            }
        });
        if (reasonLabel == null || reasonLabel.isBlank()) {
            // Provide deterministic label for FINALIZED if caller forgot.
            reasonLabel = (type == EntryType.FINALIZED) ? "تم الفصل" : "—";
        }
        HearingProgressionEntry entry = HearingProgressionEntry.builder()
                .caseStageId(stageId)
                .hearingDate(hearingDate)
                .postponementReasonCode(reasonCode)
                .postponementReasonLabel(reasonLabel)
                .enteredByUserId(actorUserId)
                .entryType(type)
                .createdAt(Instant.now())
                .build();
        return entryRepo.save(entry);
    }

    private HearingProgressionEntryDto toDto(HearingProgressionEntry e) {
        return new HearingProgressionEntryDto(
                e.getId(), e.getCaseStageId(), e.getHearingDate(),
                e.getPostponementReasonCode(), e.getPostponementReasonLabel(),
                e.getEnteredByUserId(), e.getEntryType(), e.getCreatedAt());
    }
}

