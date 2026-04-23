package sy.gov.sla.legallibrary.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * عنصر مكتبة قانونية: نص قانوني/اجتهاد/مرجع. Phase 7 (D-040).
 * نموذج بسيط — لا versioning ولا approval workflow في هذه المرحلة (D-041).
 */
@Entity
@Table(name = "legal_library_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LegalLibraryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "summary", length = 2000)
    private String summary;

    @Column(name = "body_text", nullable = false, columnDefinition = "TEXT")
    private String bodyText;

    @Column(name = "keywords", length = 1000)
    private String keywords;

    @Column(name = "source_reference", length = 300)
    private String sourceReference;

    @Column(name = "published_at")
    private LocalDate publishedAt;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

