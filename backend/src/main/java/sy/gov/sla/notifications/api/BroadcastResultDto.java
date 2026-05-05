package sy.gov.sla.notifications.api;

/**
 * PR-14 (customer feedback A-1 / Q-G expansion).
 *
 * @param recipientCount number of {@code Notification} rows actually written.
 */
public record BroadcastResultDto(int recipientCount) {}
