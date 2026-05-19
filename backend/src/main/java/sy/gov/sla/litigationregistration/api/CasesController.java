package sy.gov.sla.litigationregistration.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.litigationregistration.application.LitigationCaseService;
import sy.gov.sla.security.SecurityUtils;

import java.time.LocalDate;

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
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "hearingDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hearingDate) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listCases(page, size, actor, branchId, departmentId, courtId, q, hearingDate);
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

    /**
     * PR-11 (customer feedback C-6 / blueprint C-6) — section-head correction of
     * a finalized case. Auth uses the CURRENT stage's (branch, dept) per Q-D —
     * correction rights transfer to the destination department on promotion.
     */
    @PatchMapping("/{id}/correct")
    public LitigationCaseDto correctFinalizedCase(@PathVariable("id") Long id,
                                                  @Valid @RequestBody CorrectFinalizedCaseRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.correctFinalizedCase(id, req, actor);
    }

    /**
     * Customer feedback round-3 — admin-only hard delete of a case and
     * all its child rows (stages, hearings, decisions, execution files,
     * steps, attachments, reminders, related notifications). Authorization
     * is enforced server-side: any non-CENTRAL_SUPERVISOR caller gets 403.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        service.deleteCase(id, actor);
    }
}

