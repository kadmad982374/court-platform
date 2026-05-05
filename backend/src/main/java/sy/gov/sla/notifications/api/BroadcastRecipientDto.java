package sy.gov.sla.notifications.api;

/**
 * PR-14 (customer feedback A-1 / Q-G expansion) — minimal user-row used to
 * populate the broadcast recipient picker. Intentionally excludes mobile,
 * roles, delegated permissions, and any other sensitive data.
 */
public record BroadcastRecipientDto(
        Long userId,
        String fullName,
        String username,
        Long branchId,
        Long departmentId
) {}
