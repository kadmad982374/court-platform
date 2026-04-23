package sy.gov.sla.litigationprogression.application;

import sy.gov.sla.litigationprogression.domain.EntryType;

import java.time.Instant;
import java.time.LocalDate;

public record HearingRolledOverEvent(
        Long stageId,
        Long caseId,
        Long entryId,
        EntryType entryType,
        LocalDate previousHearingDate,
        LocalDate newHearingDate,
        String newReasonCode,
        Long actorUserId,
        Instant occurredAt
) {}

