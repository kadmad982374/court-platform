package sy.gov.sla.organization.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "branches", uniqueConstraints = @UniqueConstraint(name = "uk_branches_code", columnNames = "code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Branch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 32)
    private String code;

    @Column(name = "name_ar", nullable = false, length = 128)
    private String nameAr;

    @Column(name = "province_name", nullable = false, length = 128)
    private String provinceName;

    @Column(name = "is_active", nullable = false)
    private boolean active;
}

