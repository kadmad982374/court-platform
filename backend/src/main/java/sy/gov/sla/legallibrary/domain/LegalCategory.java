package sy.gov.sla.legallibrary.domain;

import jakarta.persistence.*;
import lombok.*;

/**
 * فئة قانونية في المكتبة (تسلسل هرمي اختياري عبر parent_id). Phase 7 (D-040).
 * الوحدة قراءة فقط في هذه المرحلة — لا يوجد write API عام.
 */
@Entity
@Table(name = "legal_categories")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LegalCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 64, updatable = false)
    private String code;

    @Column(name = "name_ar", nullable = false, length = 200)
    private String nameAr;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}

