package sy.gov.sla.litigationregistration.infrastructure;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.domain.CaseStage;
import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.LitigationCase;
import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.litigationregistration.domain.StageType;

import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.organization.infrastructure.CourtRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;

import java.time.Instant;
import java.util.Optional;

/**
 * Adapter لـ {@link CaseStagePort}. مرجع: D-023 + D-027.
 * يتعامل وحده مع CaseStageRepository و LitigationCaseRepository.
 */
@Component
@RequiredArgsConstructor
public class CaseStagePortAdapter implements CaseStagePort {

    private final CaseStageRepository stageRepo;
    private final LitigationCaseRepository caseRepo;
    private final DepartmentRepository departmentRepo;
    private final CourtRepository courtRepo;

    @Override
    @Transactional(readOnly = true)
    public Optional<StageInfo> find(Long stageId) {
        return stageRepo.findById(stageId).map(s -> {
            LitigationCase lc = caseRepo.findById(s.getLitigationCaseId()).orElse(null);
            Long owner          = lc != null ? lc.getCurrentOwnerUserId() : null;
            Long caseBranchId   = lc != null ? lc.getCreatedBranchId()    : null;
            Long caseDeptId     = lc != null ? lc.getCreatedDepartmentId() : null;
            return new StageInfo(
                    s.getId(), s.getLitigationCaseId(), s.getStageType(),
                    s.getBranchId(), s.getDepartmentId(), s.getCourtId(),
                    s.getAssignedLawyerUserId(), s.getStageStatus(),
                    s.isReadOnly(), owner,
                    caseBranchId, caseDeptId);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CaseAndCurrentStage> findCaseWithCurrentStage(Long caseId) {
        return caseRepo.findById(caseId).flatMap(lc -> {
            Long stageId = lc.getCurrentStageId();
            if (stageId == null) return Optional.empty();
            return stageRepo.findById(stageId).map(s -> new CaseAndCurrentStage(
                    lc.getId(), lc.getCreatedBranchId(), lc.getCreatedDepartmentId(),
                    lc.getCreatedCourtId(), s.getId(), s.getStageType(),
                    s.getStageStatus(), s.isReadOnly(), lc.getLifecycleStatus(),
                    lc.getCurrentOwnerUserId()));
        });
    }

    @Override
    @Transactional
    public void markInProgress(Long stageId) {
        CaseStage s = stageRepo.findById(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        if (s.getStageStatus() == StageStatus.REGISTERED || s.getStageStatus() == StageStatus.ASSIGNED) {
            s.setStageStatus(StageStatus.IN_PROGRESS);
        }
    }

    @Override
    @Transactional
    public void markFinalized(Long stageId, Instant endedAt) {
        CaseStage s = stageRepo.findById(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        s.setStageStatus(StageStatus.FINALIZED);
        s.setEndedAt(endedAt);
        caseRepo.findById(s.getLitigationCaseId()).ifPresent(lc -> {
            if (lc.getLifecycleStatus() == null) lc.setLifecycleStatus(LifecycleStatus.ACTIVE);
            lc.setUpdatedAt(endedAt);
        });
    }

    @Override
    @Transactional
    public NewAppealStageInfo promoteCurrentStageToAppeal(Long caseId, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        if (lc.getCurrentStageId() == null) {
            throw new BadRequestException("NO_CURRENT_STAGE", "Case has no current stage");
        }
        CaseStage prev = stageRepo.findById(lc.getCurrentStageId())
                .orElseThrow(() -> new NotFoundException("Current stage not found"));

        // الكتابات الذرّية فقط — التحقق من state يحدث مسبقًا في StageTransitionService.
        Instant now = Instant.now();
        prev.setReadOnly(true);
        prev.setStageStatus(StageStatus.PROMOTED_TO_APPEAL);
        if (prev.getEndedAt() == null) prev.setEndedAt(now);

        // المرحلة الجديدة من نوع APPEAL — ترث الفرع/القسم/المحكمة افتراضيًا (نفس الفرع والقسم).
        // المحكمة قد تتغير لاحقًا عبر basic-data update — هنا نضع المحكمة نفسها كنقطة بداية.
        // assigned_lawyer_user_id يبقى null حتى يحدث assign-lawyer جديد للمرحلة الجديدة.
        // first_hearing_date / first_postponement_reason: لا توجد قيم بعد — لكن العمودان NOT NULL.
        // نضع تاريخ اليوم وسببًا انتقاليًا نصيًا "تأسيس مرحلة استئناف" (حقل D-020 الانتقالي،
        // لا يُكشف في APIs الجلسات الجديدة — D-022).
        // Look up the APPEAL department for the same branch.
        // Falls back to the previous stage's department only if no APPEAL dept exists.
        Long appealDeptId = departmentRepo
                .findByBranchIdAndType(prev.getBranchId(), DepartmentType.APPEAL)
                .map(d -> d.getId())
                .orElse(prev.getDepartmentId());

        // Look up the first APPEAL-type court in this branch.
        // Falls back to the previous stage's court if none found.
        Long appealCourtId = courtRepo
                .findByBranchIdAndDepartmentType(prev.getBranchId(), DepartmentType.APPEAL)
                .stream().findFirst()
                .map(c -> c.getId())
                .orElse(prev.getCourtId());

        CaseStage appeal = CaseStage.builder()
                .litigationCaseId(lc.getId())
                .stageType(StageType.APPEAL)
                .branchId(prev.getBranchId())
                .departmentId(appealDeptId)
                .courtId(appealCourtId)
                .chamberName(prev.getChamberName())
                .stageBasisNumber(prev.getStageBasisNumber())  // مؤقت — يُحدَّث عبر basic-data
                .stageYear(prev.getStageYear())
                .stageStatus(StageStatus.REGISTERED)
                .parentStageId(prev.getId())
                .readOnly(false)
                .firstHearingDate(java.time.LocalDate.now())
                .firstPostponementReason("تأسيس مرحلة استئناف")
                .startedAt(now)
                .build();
        appeal = stageRepo.save(appeal);

        lc.setCurrentStageId(appeal.getId());
        lc.setCurrentOwnerUserId(null);                // بانتظار assign-lawyer جديد على مرحلة الاستئناف
        lc.setLifecycleStatus(LifecycleStatus.IN_APPEAL);
        lc.setUpdatedAt(now);

        return new NewAppealStageInfo(appeal.getId(), prev.getId(), lc.getId());
    }

    @Override
    @Transactional
    public PromoteToExecutionResult promoteCurrentStageToExecution(Long caseId, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        if (lc.getCurrentStageId() == null) {
            throw new BadRequestException("NO_CURRENT_STAGE", "Case has no current stage");
        }
        CaseStage prev = stageRepo.findById(lc.getCurrentStageId())
                .orElseThrow(() -> new NotFoundException("Current stage not found"));

        Long previousOwner = lc.getCurrentOwnerUserId();

        Instant now = Instant.now();
        // المرحلة السابقة: read-only + PROMOTED_TO_EXECUTION (لا تُلمس HearingProgressionEntry).
        prev.setReadOnly(true);
        prev.setStageStatus(StageStatus.PROMOTED_TO_EXECUTION);
        if (prev.getEndedAt() == null) prev.setEndedAt(now);

        // LitigationCase: lifecycle = IN_EXECUTION، صاحب الملكية يُنزع (D-024 — لا rollover/finalize بعد).
        // لا يُغيَّر current_stage_id (يبقى يشير إلى المرحلة السابقة كمرجع تاريخي للقراءة).
        lc.setLifecycleStatus(LifecycleStatus.IN_EXECUTION);
        lc.setCurrentOwnerUserId(null);
        lc.setUpdatedAt(now);

        return new PromoteToExecutionResult(
                lc.getId(), prev.getId(),
                prev.getBranchId(), prev.getDepartmentId(),
                previousOwner);
    }
}


