package sy.gov.sla.execution.api;

import sy.gov.sla.execution.domain.ExecutionStepType;

import java.time.Instant;
import java.time.LocalDate;

public record ExecutionStepDto(
        Long id,
        Long executionFileId,
        LocalDate stepDate,
        ExecutionStepType stepType,
        String stepDescription,
        Long createdByUserId,
        Instant createdAt
) {}

