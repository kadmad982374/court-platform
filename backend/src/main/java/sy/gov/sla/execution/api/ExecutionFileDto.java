package sy.gov.sla.execution.api;

import sy.gov.sla.execution.domain.ExecutionFileStatus;

import java.time.Instant;

public record ExecutionFileDto(
        Long id,
        Long litigationCaseId,
        Long sourceStageId,
        String enforcingEntityName,
        String executedAgainstName,
        String executionFileType,
        String executionFileNumber,
        int executionYear,
        Long branchId,
        Long departmentId,
        Long assignedUserId,
        ExecutionFileStatus status,
        Long createdByUserId,
        Instant createdAt,
        Instant updatedAt
) {}

