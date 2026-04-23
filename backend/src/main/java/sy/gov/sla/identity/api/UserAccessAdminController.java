package sy.gov.sla.identity.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.access.api.CourtAccessDto;
import sy.gov.sla.access.api.DelegatedPermissionDto;
import sy.gov.sla.access.api.DepartmentMembershipDto;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.identity.application.UserCourtAccessAdminService;
import sy.gov.sla.identity.application.UserDelegationAdminService;
import sy.gov.sla.identity.application.UserMembershipAdminService;
import sy.gov.sla.identity.application.UserRoleAdminService;
import sy.gov.sla.security.SecurityUtils;

/**
 * Mini-Phase B — granular per-user administration sub-resources.
 *
 * <p>Roles, memberships, delegated permissions and court access — one
 * resource per row. The bulk endpoints in {@code AccessControlController}
 * remain unchanged.</p>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users/{id:\\d+}")
public class UserAccessAdminController {

    private final UserRoleAdminService roleService;
    private final UserMembershipAdminService membershipService;
    private final UserDelegationAdminService delegationService;
    private final UserCourtAccessAdminService courtAccessService;

    // ---------- roles ----------
    @PostMapping("/roles")
    public ResponseEntity<Void> assignRole(@PathVariable("id") Long id,
                                           @Valid @RequestBody AssignRoleRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        roleService.assign(id, body.role(), actor);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @DeleteMapping("/roles/{role}")
    public ResponseEntity<Void> revokeRole(@PathVariable("id") Long id,
                                           @PathVariable("role") String role) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        RoleType parsed;
        try {
            parsed = RoleType.valueOf(role);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("INVALID_ROLE", "Unknown role: " + role);
        }
        roleService.revoke(id, parsed, actor);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    // ---------- department memberships ----------
    @PostMapping("/department-memberships")
    public ResponseEntity<DepartmentMembershipDto> addMembership(@PathVariable("id") Long id,
                                                                 @Valid @RequestBody CreateMembershipRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(membershipService.add(id, body, actor));
    }

    @PatchMapping("/department-memberships/{mid:\\d+}")
    public DepartmentMembershipDto patchMembership(@PathVariable("id") Long id,
                                                   @PathVariable("mid") Long mid,
                                                   @Valid @RequestBody UpdateMembershipRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return membershipService.patch(id, mid, body, actor);
    }

    // ---------- delegated permissions ----------
    @PostMapping("/delegated-permissions")
    public ResponseEntity<DelegatedPermissionDto> addDelegated(@PathVariable("id") Long id,
                                                               @Valid @RequestBody AddDelegatedPermissionRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(delegationService.upsert(id, body, actor));
    }

    @PatchMapping("/delegated-permissions/{pid:\\d+}")
    public DelegatedPermissionDto patchDelegated(@PathVariable("id") Long id,
                                                 @PathVariable("pid") Long pid,
                                                 @Valid @RequestBody UpdateDelegatedPermissionRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return delegationService.patch(id, pid, body, actor);
    }

    // ---------- court access ----------
    @PostMapping("/court-access")
    public ResponseEntity<CourtAccessDto> addCourtAccess(@PathVariable("id") Long id,
                                                         @Valid @RequestBody AddCourtAccessRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(courtAccessService.add(id, body, actor));
    }

    @DeleteMapping("/court-access/{caid:\\d+}")
    public ResponseEntity<Void> removeCourtAccess(@PathVariable("id") Long id,
                                                  @PathVariable("caid") Long caid) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        courtAccessService.remove(id, caid, actor);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}

