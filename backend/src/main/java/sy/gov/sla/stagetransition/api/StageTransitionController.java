package sy.gov.sla.stagetransition.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.security.SecurityUtils;
import sy.gov.sla.stagetransition.application.StageTransitionService;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/cases")
public class StageTransitionController {

    private final StageTransitionService service;

    @PostMapping("/{caseId}/promote-to-appeal")
    public PromoteToAppealResponseDto promote(@PathVariable("caseId") Long caseId) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.promoteToAppeal(caseId, actor);
    }
}

