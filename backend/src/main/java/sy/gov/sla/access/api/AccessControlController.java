package sy.gov.sla.access.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.access.application.AccessControlService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users/{id}")
public class AccessControlController {

    private final AccessControlService service;

    @GetMapping("/department-memberships")
    public List<DepartmentMembershipDto> listMemberships(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listMemberships(id, actor);
    }

    @PutMapping("/court-access")
    public List<CourtAccessDto> updateCourtAccess(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateCourtAccessRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.updateCourtAccess(id, body, actor);
    }

    @PutMapping("/delegated-permissions")
    public List<DelegatedPermissionDto> updateDelegatedPermissions(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateDelegatedPermissionsRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.updateDelegatedPermissions(id, body, actor);
    }
}

