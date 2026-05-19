package sy.gov.sla.execution.api;

import sy.gov.sla.execution.domain.ExecutionFileStatus;
import sy.gov.sla.execution.domain.ExecutionStepType;

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
        Instant updatedAt,
        // Display-side enrichment so the UI can show Arabic names instead of raw IDs.
        // Nullable when the related row is missing (defensive — should not happen).
        String branchNameAr,
        String departmentNameAr,
        String assignedUserFullName,
        String sourceCaseBasisNumber,
        Integer sourceCaseBasisYear,
        /**
         * Customer feedback round-3 — the most-recently added step's type.
         * The frontend renders this as the "الحالة" badge so it mirrors the
         * last "نوع الخطوة" instead of the static OPEN/IN_PROGRESS/... enum.
         * Null when no step has been added yet.
         */
        ExecutionStepType latestStepType
) {}

