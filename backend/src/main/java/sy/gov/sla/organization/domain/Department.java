package sy.gov.sla.organization.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "departments",
        uniqueConstraints = @UniqueConstraint(name = "uk_departments_branch_type",
                columnNames = {"branch_id", "type"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Department {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "branch_id", nullable = false)
    private Long branchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private DepartmentType type;

    @Column(name = "name_ar", nullable = false, length = 128)
    private String nameAr;

    @Column(name = "is_active", nullable = false)
    private boolean active;
}

