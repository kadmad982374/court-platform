package sy.gov.sla.decisionfinalization.api;

import jakarta.validation.constraints.*;
import sy.gov.sla.decisionfinalization.domain.DecisionType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FinalizeRequest(
        @NotBlank @Size(max = 64) String decisionNumber,
        @NotNull LocalDate decisionDate,
        @NotNull DecisionType decisionType,
        @DecimalMin(value = "0.00") BigDecimal adjudgedAmount,
        @Size(min = 3, max = 3) String currencyCode,
        @Size(max = 4000) String summaryNotes
) {}

