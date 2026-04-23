package sy.gov.sla.resolvedregister.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.resolvedregister.application.ResolvedRegisterService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/resolved-register")
public class ResolvedRegisterController {

    private final ResolvedRegisterService service;

    @GetMapping
    public List<ResolvedRegisterEntryDto> query(
            @RequestParam(value = "year",         required = false) Integer year,
            @RequestParam(value = "month",        required = false) Integer month,
            @RequestParam(value = "branchId",     required = false) Long branchId,
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "decisionType", required = false) String decisionType
    ) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.query(year, month, branchId, departmentId, decisionType, actor);
    }
}

