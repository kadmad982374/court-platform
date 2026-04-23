package sy.gov.sla.litigationregistration.application;

import java.time.Instant;

public record LawyerAssignedEvent(
        Long caseId,
        Long stageId,
        Long lawyerUserId,
        Long actorUserId,
        Instant occurredAt
) {}

