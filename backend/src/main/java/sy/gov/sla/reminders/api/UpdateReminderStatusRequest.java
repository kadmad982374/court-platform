package sy.gov.sla.reminders.api;

import jakarta.validation.constraints.NotNull;
import sy.gov.sla.reminders.domain.ReminderStatus;

public record UpdateReminderStatusRequest(
        @NotNull ReminderStatus status
) {}

