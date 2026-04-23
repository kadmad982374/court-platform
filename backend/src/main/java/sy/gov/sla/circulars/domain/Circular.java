package sy.gov.sla.circulars.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/** تعميم / قرار. Phase 7 (D-040). */
@Entity
@Table(name = "circulars")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Circular {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 64)
    private CircularSourceType sourceType;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "summary", length = 2000)
    private String summary;

    @Column(name = "body_text", nullable = false, columnDefinition = "TEXT")
    private String bodyText;

    @Column(name = "issue_date", nullable = false)
    private LocalDate issueDate;

    @Column(name = "reference_number", length = 64)
    private String referenceNumber;

    @Column(name = "keywords", length = 1000)
    private String keywords;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

