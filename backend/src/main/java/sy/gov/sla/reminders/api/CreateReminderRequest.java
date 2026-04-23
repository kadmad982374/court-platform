package sy.gov.sla.reminders.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateReminderRequest(
        @NotNull Instant reminderAt,
        @NotBlank @Size(max = 500) String reminderText,
        Long caseStageId
) {}

