package sy.gov.sla.reminders.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * تذكير شخصي للمستخدم على دعوى محددة. Phase 6 (D-037).
 *
 * المالك = منشئ التذكير (owner_user_id). لا shared reminders في Phase 6.
 */
@Entity
@Table(name = "reminders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Reminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "litigation_case_id", nullable = false, updatable = false)
    private Long litigationCaseId;

    /** اختياري: إذا أراد المستخدم تذكيرًا مرتبطًا بمرحلة محددة. */
    @Column(name = "case_stage_id", updatable = false)
    private Long caseStageId;

    @Column(name = "owner_user_id", nullable = false, updatable = false)
    private Long ownerUserId;

    @Column(name = "reminder_at", nullable = false, updatable = false)
    private Instant reminderAt;

    @Column(name = "reminder_text", nullable = false, length = 500, updatable = false)
    private String reminderText;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ReminderStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

