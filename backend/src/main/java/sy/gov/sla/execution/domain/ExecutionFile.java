package sy.gov.sla.execution.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * الملف التنفيذي. مرجع: D-028 (Phase 5).
 *
 * مسار مستقل عن CaseStage (D-003): التنفيذ ليس مرحلة قضائية ولا يحوي جلسات.
 * يُربط بـ {@code litigationCaseId} و {@code sourceStageId} (المرحلة المُرَقَّاة منها).
 *
 * @Setter يُترك كاملًا للحقول العامة لإتاحة تعديل {@code status} و {@code assignedUserId}
 * في مراحل لاحقة عبر endpoints جديدة (لا يوجد منها شيء في Phase 5).
 * الحقول التاريخية مُعلَّمة {@code updatable = false} لمنع تعديلها.
 */
@Entity
@Table(name = "execution_files",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_ef_number_year_branch",
                columnNames = {"branch_id", "execution_year", "execution_file_number"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExecutionFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "litigation_case_id", nullable = false, updatable = false)
    private Long litigationCaseId;

    @Column(name = "source_stage_id", nullable = false, updatable = false)
    private Long sourceStageId;

    @Column(name = "enforcing_entity_name", nullable = false, length = 200, updatable = false)
    private String enforcingEntityName;

    @Column(name = "executed_against_name", nullable = false, length = 200, updatable = false)
    private String executedAgainstName;

    @Column(name = "execution_file_type", nullable = false, length = 64, updatable = false)
    private String executionFileType;

    @Column(name = "execution_file_number", nullable = false, length = 64, updatable = false)
    private String executionFileNumber;

    @Column(name = "execution_year", nullable = false, updatable = false)
    private int executionYear;

    @Column(name = "branch_id", nullable = false, updatable = false)
    private Long branchId;

    @Column(name = "department_id", nullable = false, updatable = false)
    private Long departmentId;

    @Column(name = "assigned_user_id")
    private Long assignedUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ExecutionFileStatus status;

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Optimistic-lock counter — prevents lost updates on status (OPEN→CLOSED)
     *  and assignedUserId from racing concurrent writes. */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;
}

