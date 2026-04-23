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

    @Column(name = "decision_number", nullable = false, length = 64, updatable = false)
    private String decisionNumber;

    @Column(name = "decision_date", nullable = false, updatable = false)
    private LocalDate decisionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision_type", nullable = false, length = 32, updatable = false)
    private DecisionType decisionType;

    @Column(name = "adjudged_amount", precision = 18, scale = 2, updatable = false)
    private BigDecimal adjudgedAmount;

    @Column(name = "currency_code", length = 3, updatable = false)
    private String currencyCode;

    @Column(name = "summary_notes", columnDefinition = "TEXT", updatable = false)
    private String summaryNotes;

    @Column(name = "finalized_by_user_id", nullable = false, updatable = false)
    private Long finalizedByUserId;

    @Column(name = "finalized_at", nullable = false, updatable = false)
    private Instant finalizedAt;
}

