package sy.gov.sla.reports.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sy.gov.sla.reports.application.ReportsService;
import sy.gov.sla.security.SecurityUtils;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/reports")
public class ReportsController {

    private final ReportsService service;

    /**
     * PR-13 (customer feedback A-2 / Q-B / Q-F): aggregated case statistics
     * scoped to the actor's read scope (D-021/D-025). Drives the dashboard
     * pie + the cases-page summary card. Money totals are
     * {@code adjudged_amount} only per Q-F.
     */
    @GetMapping("/case-summary")
    public CaseSummaryDto caseSummary() {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.caseSummary(actor);
    }
}
