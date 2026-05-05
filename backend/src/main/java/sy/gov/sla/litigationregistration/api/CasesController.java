package sy.gov.sla.litigationregistration.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.litigationregistration.application.LitigationCaseService;
import sy.gov.sla.security.SecurityUtils;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/cases")
public class CasesController {

    private final LitigationCaseService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LitigationCaseDto create(@Valid @RequestBody CreateCaseRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.createCase(req, actor);
    }

    /**
     * PR-9 (customer feedback A-3 / B-1 / C-1 / D-1) — filtered listing.
     * All four filter params are optional and applied on top of the role scope.
     */
    @GetMapping
    public PageResponse<LitigationCaseDto> list(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "branchId", required = false) Long branchId,
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "courtId", required = false) Long courtId,
            @RequestParam(value = "q", required = false) String q) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listCases(page, size, actor, branchId, departmentId, courtId, q);
    }

    @GetMapping("/{id}")
    public LitigationCaseDto get(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.getCase(id, actor);
    }

    @GetMapping("/{id}/stages")
    public java.util.List<CaseStageDto> listStages(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listStages(id, actor);
    }

    @PutMapping("/{id}/basic-data")
    public LitigationCaseDto updateBasicData(@PathVariable("id") Long id,
                                             @Valid @RequestBody UpdateBasicDataRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.updateBasicData(id, req, actor);
    }

    @PostMapping("/{id}/assign-lawyer")
    public LitigationCaseDto assignLawyer(@PathVariable("id") Long id,
                                          @Valid @RequestBody AssignLawyerRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.assignLawyer(id, req, actor);
    }
}

