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

    @GetMapping
    public PageResponse<LitigationCaseDto> list(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listCases(page, size, actor);
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

