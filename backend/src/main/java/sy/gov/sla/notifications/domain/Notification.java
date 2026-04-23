package sy.gov.sla.notifications.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * إشعار داخلي للمستخدم. Phase 6 (D-038/D-010).
 *
 * Phase 6 لا قنوات خارجية (SMS/email/push). الإشعار سجل DB يُقرأ عبر REST.
 *
 * `notification_type` نص حر مغلق فعليًا (يُحدَّد من المُولِّد):
 *  - CASE_REGISTERED
 *  - LAWYER_ASSIGNED
 * يمكن إضافة أنواع جديدة بدون migration.
 */
@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_user_id", nullable = false, updatable = false)
    private Long recipientUserId;

    @Column(name = "notification_type", nullable = false, length = 64, updatable = false)
    private String notificationType;

    @Column(name = "title", nullable = false, length = 200, updatable = false)
    private String title;

    @Column(name = "body", nullable = false, length = 2000, updatable = false)
    private String body;

    @Column(name = "related_entity_type", length = 64, updatable = false)
    private String relatedEntityType;

    @Column(name = "related_entity_id", updatable = false)
    private Long relatedEntityId;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;
}

