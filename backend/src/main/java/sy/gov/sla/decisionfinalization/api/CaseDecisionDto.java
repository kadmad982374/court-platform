package sy.gov.sla.decisionfinalization.api;

import sy.gov.sla.decisionfinalization.domain.DecisionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record CaseDecisionDto(
        Long id,
        Long caseStageId,
        String decisionNumber,
        LocalDate decisionDate,
        DecisionType decisionType,
        BigDecimal adjudgedAmount,
        String currencyCode,
        String summaryNotes,
        Long finalizedByUserId,
        Instant finalizedAt
) {}

