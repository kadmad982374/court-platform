package sy.gov.sla.access.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_department_memberships")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDepartmentMembership {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "branch_id", nullable = false)
    private Long branchId;

    /**
     * department_id يكون null للأدوار الفرعية (مثل BRANCH_HEAD)
     * التي لا تنتمي إلى قسم بعينه.
     */
    @Column(name = "department_id")
    private Long departmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "membership_type", nullable = false, length = 32)
    private MembershipType membershipType;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @Column(name = "is_active", nullable = false)
    private boolean active;
}

