package sy.gov.sla.notifications.api;

import java.time.Instant;

public record NotificationDto(
        Long id,
        Long recipientUserId,
        String notificationType,
        String title,
        String body,
        String relatedEntityType,
        Long relatedEntityId,
        boolean read,
        Instant createdAt,
        Instant readAt
) {}

