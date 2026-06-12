package sy.gov.sla.pendingsubmission.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * سجل «تحت الرفع» — كتاب وارد بانتظار رفع الدعوى (طلب العميل #3).
 *
 * سجلّ خفيف سابق للدعوى (لا دورة حياة/مراحل). مرتبط بـ (فرع، قسم) للتحكّم
 * بالوصول مثل الدعاوى: رئيس القسم والموظف الإداري يضيفان، ورئيس الفرع
 * والمشرف المركزي يطّلعان فقط.
 */
@Entity
@Table(name = "pending_submissions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PendingSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "branch_id", nullable = false)
    private Long branchId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    /** رقم الوارد. */
    @Column(name = "incoming_number", nullable = false, length = 64)
    private String incomingNumber;

    /** رقم الكتاب. */
    @Column(name = "letter_number", length = 64)
    private String letterNumber;

    /** الجهة العامة. */
    @Column(name = "public_entity_name", nullable = false, length = 200)
    private String publicEntityName;

    /** الخصم. */
    @Column(name = "opponent_name", length = 200)
    private String opponentName;

    /** موضوع الكتاب. */
    @Column(name = "subject", length = 500)
    private String subject;

    /** ملاحظات. */
    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;
}
