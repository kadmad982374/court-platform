package sy.gov.sla.execution.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * خطوة تنفيذية مؤرَّخة (append-only). مرجع: D-031 (Phase 5)، مرآة لـ HearingProgressionEntry (D-022).
 *
 * كل الأعمدة {@code updatable = false} ولا setters عمومية:
 *  - لا تعديل بعد الإدراج.
 *  - لا حذف (الـ repository لا يكشف delete*).
 *  - لا API لـ PUT/DELETE على /steps.
 */
@Entity
@Table(name = "execution_steps")
@Getter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExecutionStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false)
    private Long id;

    @Column(name = "execution_file_id", nullable = false, updatable = false)
    private Long executionFileId;

    @Column(name = "step_date", nullable = false, updatable = false)
    private LocalDate stepDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false, length = 32, updatable = false)
    private ExecutionStepType stepType;

    @Column(name = "step_description", nullable = false, length = 2000, updatable = false)
    private String stepDescription;

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

