package sy.gov.sla.litigationprogression.api;

import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.litigationregistration.domain.StageType;

import java.time.Instant;

public record StageDto(
        Long id,
        Long litigationCaseId,
        StageType stageType,
        Long branchId,
        Long departmentId,
        Long courtId,
        Long assignedLawyerUserId,
        StageStatus stageStatus,
        boolean readOnly,
        Instant endedAt
) {}

