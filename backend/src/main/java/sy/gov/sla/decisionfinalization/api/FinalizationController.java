package sy.gov.sla.decisionfinalization.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.decisionfinalization.application.DecisionFinalizationService;
import sy.gov.sla.security.SecurityUtils;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/stages")
public class FinalizationController {

    private final DecisionFinalizationService service;

    @PostMapping("/{stageId}/finalize")
    public CaseDecisionDto finalize(@PathVariable("stageId") Long stageId,
                                    @Valid @RequestBody FinalizeRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.finalize(stageId, req, actor);
    }
}

