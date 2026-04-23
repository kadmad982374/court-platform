package sy.gov.sla.litigationprogression.domain;

import jakarta.persistence.*;
import lombok.*;

/**
 * قائمة أسباب التأجيل المعيارية. مرجع: الوظيفية §6.5، D-008، D-022.
 * Reference table مُدارة عبر Flyway seed.
 */
@Entity
@Table(name = "postponement_reasons")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PostponementReason {

    @Id
    @Column(name = "code", nullable = false, length = 64)
    private String code;

    @Column(name = "label_ar", nullable = false, length = 200)
    private String labelAr;

    @Column(name = "is_active", nullable = false)
    private boolean active;
}

