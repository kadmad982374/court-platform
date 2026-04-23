package sy.gov.sla.execution.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.execution.application.ExecutionService;
import sy.gov.sla.execution.domain.ExecutionFileStatus;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ExecutionController {

    private final ExecutionService service;

    // POST /api/v1/cases/{caseId}/promote-to-execution
    @PostMapping("/cases/{caseId}/promote-to-execution")
    public ExecutionFileDto promote(@PathVariable("caseId") Long caseId,
                                    @Valid @RequestBody PromoteToExecutionRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.promoteCaseToExecution(caseId, req, actor);
    }

    @GetMapping("/execution-files")
    public List<ExecutionFileDto> list(
            @RequestParam(value = "branchId",     required = false) Long branchId,
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "status",       required = false) ExecutionFileStatus status,
            @RequestParam(value = "year",         required = false) Integer year,
            @RequestParam(value = "page",         defaultValue = "0")  int page,
            @RequestParam(value = "size",         defaultValue = "20") int size
    ) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listFiles(branchId, departmentId, status, year, page, size, actor);
    }

    @GetMapping("/execution-files/{id}")
    public ExecutionFileDto get(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.getFile(id, actor);
    }

    @PostMapping("/execution-files/{id}/steps")
    public ExecutionStepDto addStep(@PathVariable("id") Long id,
                                    @Valid @RequestBody AddExecutionStepRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.addStep(id, req, actor);
    }

    @GetMapping("/execution-files/{id}/steps")
    public List<ExecutionStepDto> listSteps(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listSteps(id, actor);
    }
}

