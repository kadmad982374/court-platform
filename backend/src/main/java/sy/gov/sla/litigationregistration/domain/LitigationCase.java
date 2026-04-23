package sy.gov.sla.litigationregistration.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * هوية الملف الأصلية للدعوى. مرجع: التقنية §5.3.
 *
 * ملاحظات تصميمية:
 *  - {@code originalRegistrationDate} ثابت لا يُعدَّل بعد الإنشاء (D-006).
 *  - {@code currentStageId} يُحدَّث عند إنشاء/تبديل المرحلة الحالية (مرحلة الانتقال — لاحقًا).
 *  - {@code currentOwnerUserId} يُحدَّث فور الإسناد لمحامٍ، وهو الأساس لـ requireCaseOwnership.
 *  - لا توجد FKs للأمام (currentStageId, currentOwnerUserId) لتجنب الاعتمادات الدائرية؛
 *    التكامل مفروض في طبقة Application.
 */
@Entity
@Table(name = "litigation_cases")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LitigationCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_entity_name", nullable = false, length = 200)
    private String publicEntityName;

    @Enumerated(EnumType.STRING)
    @Column(name = "public_entity_position", nullable = false, length = 16)
    private PublicEntityPosition publicEntityPosition;

    @Column(name = "opponent_name", nullable = false, length = 200)
    private String opponentName;

    @Column(name = "original_basis_number", nullable = false, length = 64)
    private String originalBasisNumber;

    @Column(name = "basis_year", nullable = false)
    private int basisYear;

    /** ثابت لا يتغير — D-006. */
    @Column(name = "original_registration_date", nullable = false, updatable = false)
    private LocalDate originalRegistrationDate;

    @Column(name = "created_branch_id", nullable = false)
    private Long createdBranchId;

    @Column(name = "created_department_id", nullable = false)
    private Long createdDepartmentId;

    @Column(name = "created_court_id", nullable = false)
    private Long createdCourtId;

    @Column(name = "chamber_name", length = 128)
    private String chamberName;

    /** Forward reference (no FK). */
    @Column(name = "current_stage_id")
    private Long currentStageId;

    /** المحامي المالك حاليًا — مفتاح قاعدة ملكية المحامي (الوظيفية §4.1). */
    @Column(name = "current_owner_user_id")
    private Long currentOwnerUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "lifecycle_status", nullable = false, length = 32)
    private LifecycleStatus lifecycleStatus;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

