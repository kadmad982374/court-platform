package sy.gov.sla.execution.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import sy.gov.sla.execution.domain.ExecutionStepType;

import java.time.LocalDate;

public record AddExecutionStepRequest(
        @NotNull LocalDate stepDate,
        @NotNull ExecutionStepType stepType,
        @NotBlank @Size(max = 2000) String stepDescription
) {}

