package sy.gov.sla.publicentitydirectory.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** عنصر في دليل الجهات العامة. Phase 7 (D-040). */
@Entity
@Table(name = "public_entity_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PublicEntityItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "name_ar", nullable = false, length = 300)
    private String nameAr;

    @Column(name = "short_description", length = 500)
    private String shortDescription;

    @Column(name = "details_text", columnDefinition = "TEXT")
    private String detailsText;

    @Column(name = "keywords", length = 1000)
    private String keywords;

    @Column(name = "reference_code", length = 64)
    private String referenceCode;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

