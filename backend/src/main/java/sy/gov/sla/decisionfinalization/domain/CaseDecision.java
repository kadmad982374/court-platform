package sy.gov.sla.decisionfinalization.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "case_decisions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CaseDecision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_stage_id", nullable = false, unique = true, updatable = false)
    private Long caseStageId;

    /** PR-11 (customer feedback C-6): mutable so a section head may correct it
     *  via {@code PATCH /api/v1/cases/{id}/correct} when the stage is still the
     *  current (non-promoted) one. Wire-level guard lives in the service. */
    @Column(name = "decision_number", nullable = false, length = 64)
    private String decisionNumber;

    /** PR-11: see decisionNumber. */
    @Column(name = "decision_date", nullable = false)
    private LocalDate decisionDate;

    /** PR-11: see decisionNumber. */
    @Enumerated(EnumType.STRING)
    @Column(name = "decision_type", nullable = false, length = 32)
    private DecisionType decisionType;

    /** PR-11: see decisionNumber. Optional — present only for monetary decisions. */
    @Column(name = "adjudged_amount", precision = 18, scale = 2)
    private BigDecimal adjudgedAmount;

    /** PR-11: see decisionNumber. */
    @Column(name = "currency_code", length = 3)
    private String currencyCode;

    /** PR-11: see decisionNumber. */
    @Column(name = "summary_notes", columnDefinition = "TEXT")
    private String summaryNotes;

    @Column(name = "finalized_by_user_id", nullable = false, updatable = false)
    private Long finalizedByUserId;

    @Column(name = "finalized_at", nullable = false, updatable = false)
    private Instant finalizedAt;
}

