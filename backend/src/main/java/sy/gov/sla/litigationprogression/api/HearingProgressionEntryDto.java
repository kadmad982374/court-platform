package sy.gov.sla.litigationprogression.api;

import sy.gov.sla.litigationprogression.domain.EntryType;

import java.time.Instant;
import java.time.LocalDate;

public record HearingProgressionEntryDto(
        Long id,
        Long caseStageId,
        LocalDate hearingDate,
        String postponementReasonCode,
        String postponementReasonLabel,
        Long enteredByUserId,
        EntryType entryType,
        Instant createdAt
) {}

