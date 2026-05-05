package sy.gov.sla.reports.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * PR-13 (customer feedback A-2 / Q-B / Q-F) — aggregated case statistics
 * scoped to the actor's read scope (D-021/D-025).
 *
 * <p>Exposes three orthogonal slices so the frontend can build the customer's
 * pie chart (lifecycle vs. decision-type bands) without needing follow-up
 * calls. Money totals are restricted to {@code adjudged_amount} per Q-F
 * (settlement amount and costs intentionally excluded for v1).</p>
 */
public record CaseSummaryDto(
        long totalCases,
        Map<String, Long> byLifecycle,
        Map<String, Long> byDecisionType,
        List<CurrencyTotalDto> adjudgedTotalsByCurrency
) {
    public record CurrencyTotalDto(String currencyCode, BigDecimal total) {}
}
