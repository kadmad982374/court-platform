package sy.gov.sla.reports.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * PR-13 (customer feedback A-2 / Q-B / Q-F) — aggregated case statistics
 * scoped to the actor's read scope (D-021/D-025).
 *
 * <p>Slices:</p>
 * <ul>
 *   <li>{@code byCurrentOutcome} — mutually-exclusive bucket per case.
 *       Each case contributes exactly one row to one of:
 *       {@code ACTIVE}, {@code RESOLVED_NO_DECISION},
 *       {@code FOR_ENTITY}, {@code AGAINST_ENTITY},
 *       {@code SETTLEMENT}, {@code NON_FINAL}.
 *       Sum of values == {@code totalCases}. This is the slice the
 *       dashboard pie renders (PR-13b fix).</li>
 *   <li>{@code byLifecycle} / {@code byDecisionType} — raw counts kept for
 *       follow-up reports; the dashboard does NOT use them for the pie
 *       because they double-count cases that have a decision attached
 *       to a now-superseded stage.</li>
 *   <li>{@code adjudgedTotalsByCurrency} — money totals restricted to
 *       {@code adjudged_amount} per Q-F (settlement amount and costs
 *       intentionally excluded for v1).</li>
 * </ul>
 */
public record CaseSummaryDto(
        long totalCases,
        Map<String, Long> byCurrentOutcome,
        Map<String, Long> byLifecycle,
        Map<String, Long> byDecisionType,
        List<CurrencyTotalDto> adjudgedTotalsByCurrency
) {
    public record CurrencyTotalDto(String currencyCode, BigDecimal total) {}
}
