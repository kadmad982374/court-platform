package sy.gov.sla.litigationregistration.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * مرحلة قضائية لملف. مرجع: التقنية §5.3.
 *
 * في المرحلة 2 تُستخدم لإنشاء المرحلة الأولى عند القيد (CONCILIATION/FIRST_INSTANCE/APPEAL).
 * لا يُنفَّذ منطق ترقية الاستئناف هنا (المرحلة 4).
 *
 * الحقول الانتقالية لـ "تاريخ الجلسة الأولى" و"سبب التأجيل الأول" مُخزَّنة هنا
 * لحين إدخال {@code HearingProgressionEntry} في المرحلة 3 — انظر D-020.
 */
@Entity
@Table(name = "case_stages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CaseStage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "litigation_case_id", nullable = false)
    private Long litigationCaseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "stage_type", nullable = false, length = 32)
    private StageType stageType;

    @Column(name = "branch_id", nullable = false)
    private Long branchId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "court_id", nullable = false)
    private Long courtId;

    @Column(name = "chamber_name", length = 128)
    private String chamberName;

    @Column(name = "stage_basis_number", nullable = false, length = 64)
    private String stageBasisNumber;

    @Column(name = "stage_year", nullable = false)
    private int stageYear;

    @Column(name = "assigned_lawyer_user_id")
    private Long assignedLawyerUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "stage_status", nullable = false, length = 32)
    private StageStatus stageStatus;

    /** قابل للأخذ في المرحلة 4 عند ترقية الاستئناف. */
    @Column(name = "parent_stage_id")
    private Long parentStageId;

    @Column(name = "is_read_only", nullable = false)
    private boolean readOnly;

    /** انتقالي — D-020 (سيُنقل إلى HearingProgressionEntry في المرحلة 3). */
    @Column(name = "first_hearing_date", nullable = false)
    private LocalDate firstHearingDate;

    /** انتقالي — D-020. */
    @Column(name = "first_postponement_reason", nullable = false, length = 200)
    private String firstPostponementReason;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;
}

