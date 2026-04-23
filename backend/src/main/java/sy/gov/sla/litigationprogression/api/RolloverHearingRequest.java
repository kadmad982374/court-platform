package sy.gov.sla.litigationprogression.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record RolloverHearingRequest(
        @NotNull LocalDate nextHearingDate,
        @NotBlank String postponementReasonCode
) {}

