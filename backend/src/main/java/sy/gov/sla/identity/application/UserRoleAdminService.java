package sy.gov.sla.identity.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.Role;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.access.domain.UserRole;
import sy.gov.sla.access.infrastructure.RoleRepository;
import sy.gov.sla.access.infrastructure.UserRoleRepository;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.identity.infrastructure.UserRepository;

/**
 * Mini-Phase B — manage role assignments on a user.
 *
 * <p>Authorization (D-048):
 * <ul>
 *   <li>{@code CENTRAL_SUPERVISOR} may assign or revoke any role.</li>
 *   <li>No other role may grant or revoke roles in Mini-Phase B.</li>
 *   <li>Even when later relaxed, a {@code BRANCH_HEAD} must never be able
 *       to grant or revoke the {@link RoleType#BRANCH_HEAD} role
 *       (defensive guard {@code BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD}).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserRoleAdminService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final AuthorizationService authorizationService;

    public void assign(Long userId, RoleType role, Long actorUserId) {
        AuthorizationContext actor = requireAuthorized(actorUserId, role);
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }
        Role r = roleRepository.findByType(role)
                .orElseThrow(() -> new BadRequestException("ROLE_NOT_FOUND", "Role not found: " + role));
        // idempotent
        if (userRoleRepository.findByUserIdAndRoleId(userId, r.getId()).isPresent()) {
            return;
        }
        userRoleRepository.save(UserRole.builder().userId(userId).roleId(r.getId()).build());
    }

    public void revoke(Long userId, RoleType role, Long actorUserId) {
        AuthorizationContext actor = requireAuthorized(actorUserId, role);
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }
        Role r = roleRepository.findByType(role)
                .orElseThrow(() -> new BadRequestException("ROLE_NOT_FOUND", "Role not found: " + role));
        UserRole existing = userRoleRepository.findByUserIdAndRoleId(userId, r.getId())
                .orElseThrow(() -> new NotFoundException("Role not assigned"));
        userRoleRepository.delete(existing);
    }

    private AuthorizationContext requireAuthorized(Long actorUserId, RoleType targetRole) {
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        // D-048: BRANCH_HEAD never grants/revokes BRANCH_HEAD, regardless of any
        // future relaxation that lets BRANCH_HEAD manage other roles.
        if (targetRole == RoleType.BRANCH_HEAD && !actor.isCentralSupervisor()) {
            throw new ForbiddenException("BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD",
                    "Only CENTRAL_SUPERVISOR may grant or revoke the BRANCH_HEAD role");
        }
        if (!actor.isCentralSupervisor()) {
            throw new ForbiddenException("Only CENTRAL_SUPERVISOR may grant or revoke roles");
        }
        return actor;
    }
}

