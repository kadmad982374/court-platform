package sy.gov.sla.litigationregistration.api;

import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.litigationregistration.domain.StageType;

import java.time.Instant;
import java.time.LocalDate;

public record CaseStageDto(
        Long id,
        Long litigationCaseId,
        StageType stageType,
        Long branchId,
        Long departmentId,
        Long courtId,
        String chamberName,
        String stageBasisNumber,
        int stageYear,
        Long assignedLawyerUserId,
        StageStatus stageStatus,
        Long parentStageId,
        boolean readOnly,
        LocalDate firstHearingDate,
        String firstPostponementReason,
        Instant startedAt,
        Instant endedAt
) {}

