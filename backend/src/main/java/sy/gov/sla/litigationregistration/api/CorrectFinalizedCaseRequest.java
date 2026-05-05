package sy.gov.sla.litigationregistration.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import sy.gov.sla.decisionfinalization.domain.DecisionType;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * PR-11 (customer feedback C-6 / blueprint C-6) — patch payload for
 * {@code PATCH /api/v1/cases/{id}/correct}.
 *
 * <p>All fields optional. The service applies the union of supplied fields to:
 * <ul>
 *   <li>The case ({@code originalBasisNumber}, {@code basisYear}).</li>
 *   <li>The CURRENT stage ({@code stageBasisNumber}, {@code stageYear}).</li>
 *   <li>The CURRENT stage's decision ({@code decisionNumber},
 *       {@code decisionDate}, {@code decisionType},
 *       {@code adjudgedAmount}, {@code currencyCode}).</li>
 * </ul>
 *
 * <p>Pre-conditions enforced server-side (per customer Q-D):
 * <ol>
 *   <li>The case's current stage MUST be FINALIZED and NOT read-only — so the
 *       case hasn't been promoted past it. Once a stage is promoted to appeal
 *       or execution, correction rights move to the destination department's
 *       section head.</li>
 *   <li>Actor must be SECTION_HEAD of the current stage's (branch, dept), OR
 *       ADMIN_CLERK with {@code CORRECT_FINALIZED_CASE} delegation.</li>
 * </ol>
 *
 * <p>Hearing history (D-022 append-only) is NEVER touched.
 */
public record CorrectFinalizedCaseRequest(
        @Size(max = 64)  String originalBasisNumber,
        @Min(1900)       Integer basisYear,
        @Size(max = 64)  String stageBasisNumber,
        @Min(1900)       Integer stageYear,
        @Size(max = 64)  String decisionNumber,
        LocalDate decisionDate,
        DecisionType decisionType,
        BigDecimal adjudgedAmount,
        @Size(min = 3, max = 3) String currencyCode
) {}
