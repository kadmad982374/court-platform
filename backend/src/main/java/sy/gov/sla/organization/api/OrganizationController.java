package sy.gov.sla.organization.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.organization.application.OrganizationService;
import sy.gov.sla.organization.domain.DepartmentType;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class OrganizationController {

    private final OrganizationService service;

    @GetMapping("/branches")
    public List<BranchDto> listBranches() {
        return service.listBranches();
    }

    @GetMapping("/branches/{id}/departments")
    public List<DepartmentDto> listDepartments(@PathVariable("id") Long id) {
        return service.listDepartments(id);
    }

    @GetMapping("/courts")
    public List<CourtDto> listCourts(
            @RequestParam(value = "branchId", required = false) Long branchId,
            @RequestParam(value = "departmentType", required = false) DepartmentType departmentType
    ) {
        return service.listCourts(branchId, departmentType);
    }
}

