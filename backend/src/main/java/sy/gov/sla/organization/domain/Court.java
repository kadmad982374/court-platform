package sy.gov.sla.organization.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "courts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Court {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "branch_id", nullable = false)
    private Long branchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "department_type", nullable = false, length = 32)
    private DepartmentType departmentType;

    @Column(name = "name_ar", nullable = false, length = 160)
    private String nameAr;

    @Column(name = "chamber_support", nullable = false)
    private boolean chamberSupport;

    @Column(name = "is_active", nullable = false)
    private boolean active;
}

