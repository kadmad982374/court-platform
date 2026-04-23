package sy.gov.sla.identity.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.identity.application.UserQueryService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users")
public class UsersController {

    private final UserQueryService service;

    @GetMapping("/me")
    public CurrentUserDto me() {
        return service.getCurrentUser(SecurityUtils.currentUserOrThrow().userId());
    }

    /**
     * Mini-Phase A — Assign Lawyer (D-046).
     *
     * Read-only listing of users eligible for lawyer assignment in a given
     * (branch, department). Intentionally narrow:
     *   - Only {@code membershipType=STATE_LAWYER} is supported in this mini-phase.
     *   - Only {@code SECTION_HEAD} of the department, or {@code ADMIN_CLERK}
     *     of the department with {@code ASSIGN_LAWYER} delegation, may call.
     *   - Response intentionally excludes mobileNumber, delegated permissions
     *     and any other sensitive data.
     *
     * NOT a generic Users Admin endpoint — that work lives in the new
     * Mini-Phase B {@code UsersAdminController} (D-047/D-048). This handler
     * is selected only when the {@code membershipType} query parameter is
     * present.
     */
    @GetMapping(params = "membershipType")
    public List<AssignableLawyerDto> listAssignableLawyers(
            @RequestParam(value = "branchId",       required = false) Long branchId,
            @RequestParam(value = "departmentId",   required = false) Long departmentId,
            @RequestParam(value = "membershipType", required = false, defaultValue = "STATE_LAWYER")
                    String membershipType,
            @RequestParam(value = "activeOnly",     required = false, defaultValue = "true")
                    boolean activeOnly) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        MembershipType type = parseMembershipType(membershipType);
        return service.listAssignableLawyers(actor, branchId, departmentId, type, activeOnly);
    }

    private static MembershipType parseMembershipType(String raw) {
        if (raw == null || raw.isBlank()) return MembershipType.STATE_LAWYER;
        try {
            return MembershipType.valueOf(raw);
        } catch (IllegalArgumentException ex) {
            throw new sy.gov.sla.common.exception.BadRequestException(
                    "INVALID_MEMBERSHIP_TYPE",
                    "Unknown membershipType: " + raw);
        }
    }
}

