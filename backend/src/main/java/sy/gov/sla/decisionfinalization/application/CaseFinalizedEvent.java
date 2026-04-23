package sy.gov.sla.decisionfinalization.application;

import sy.gov.sla.decisionfinalization.domain.DecisionType;

import java.time.Instant;
import java.time.LocalDate;

public record CaseFinalizedEvent(
        Long caseId,
        Long stageId,
        Long decisionId,
        DecisionType decisionType,
        LocalDate decisionDate,
        Long actorUserId,
        Instant occurredAt
) {}

