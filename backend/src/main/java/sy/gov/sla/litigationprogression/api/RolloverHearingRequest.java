package sy.gov.sla.litigationprogression.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record RolloverHearingRequest(
        @NotNull LocalDate nextHearingDate,
        @NotBlank String postponementReasonCode,
        @Size(max = 2000) String notes
) {}

