package sy.gov.sla.reminders.api;

import sy.gov.sla.reminders.domain.ReminderStatus;

import java.time.Instant;

public record ReminderDto(
        Long id,
        Long litigationCaseId,
        Long caseStageId,
        Long ownerUserId,
        Instant reminderAt,
        String reminderText,
        ReminderStatus status,
        Instant createdAt
) {}

