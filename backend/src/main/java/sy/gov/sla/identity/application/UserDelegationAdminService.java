package sy.gov.sla.identity.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.api.DelegatedPermissionDto;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.UserDelegatedPermission;
import sy.gov.sla.access.infrastructure.UserDelegatedPermissionRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.identity.api.AddDelegatedPermissionRequest;
import sy.gov.sla.identity.api.UpdateDelegatedPermissionRequest;
import sy.gov.sla.identity.infrastructure.UserRepository;

import java.time.Instant;

/**
 * Mini-Phase B — manage delegated permissions of a user (D-004).
 *
 * <p>Authorization:
 * <ul>
 *   <li>{@code CENTRAL_SUPERVISOR} may grant/revoke any delegation.</li>
 *   <li>A {@code SECTION_HEAD} may grant/revoke a delegation only for an
 *       active {@code ADMIN_CLERK} in his own department.</li>
 *   <li>Anyone else: 403.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserDelegationAdminService {

    private final UserRepository userRepository;
    private final UserDelegatedPermissionRepository delegatedRepo;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final AuthorizationService authorizationService;

    public DelegatedPermissionDto upsert(Long userId, AddDelegatedPermissionRequest req, Long actorUserId) {
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireScope(actor, userId);

        var existing = delegatedRepo.findByUserIdAndPermissionCode(userId, req.code());
        UserDelegatedPermission p;
        if (existing.isPresent()) {
            p = existing.get();
            p.setGranted(req.granted());
            p.setGrantedByUserId(actorUserId);
            p.setGrantedAt(Instant.now());
        } else {
            p = delegatedRepo.save(UserDelegatedPermission.builder()
                    .userId(userId)
                    .permissionCode(req.code())
                    .granted(req.granted())
                    .grantedByUserId(actorUserId)
                    .grantedAt(Instant.now())
                    .build());
        }
        if (p.isGranted()) {
            UserActionLog.action("granted delegation '{}' to user #{}", p.getPermissionCode(), userId);
        } else {
            UserActionLog.action("revoked delegation '{}' from user #{}", p.getPermissionCode(), userId);
        }
        return toDto(p);
    }

    public DelegatedPermissionDto patch(Long userId, Long permissionId,
                                        UpdateDelegatedPermissionRequest req, Long actorUserId) {
        UserDelegatedPermission p = delegatedRepo.findById(permissionId)
                .orElseThrow(() -> new NotFoundException("Delegated permission not found: " + permissionId));
        if (!p.getUserId().equals(userId)) {
            throw new NotFoundException("Delegated permission not found for user " + userId);
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireScope(actor, userId);

        p.setGranted(req.granted());
        p.setGrantedByUserId(actorUserId);
        p.setGrantedAt(Instant.now());
        if (p.isGranted()) {
            UserActionLog.action("granted delegation '{}' to user #{}", p.getPermissionCode(), userId);
        } else {
            UserActionLog.action("revoked delegation '{}' from user #{}", p.getPermissionCode(), userId);
        }
        return toDto(p);
    }

    private void requireScope(AuthorizationContext actor, Long targetUserId) {
        if (actor.isCentralSupervisor()) return;
        // SECTION_HEAD may manage delegations only for an active ADMIN_CLERK in
        // his own department (D-004).
        boolean ok = membershipRepo.findByUserIdAndActiveTrue(targetUserId).stream().anyMatch(m ->
                m.getMembershipType() == MembershipType.ADMIN_CLERK
                        && m.getDepartmentId() != null
                        && actor.isSectionHeadOf(m.getBranchId(), m.getDepartmentId()));
        if (!ok) {
            throw new ForbiddenException(
                    "Delegations can only be set by the department's section head on its admin clerk");
        }
    }

    private DelegatedPermissionDto toDto(UserDelegatedPermission p) {
        return new DelegatedPermissionDto(p.getId(), p.getUserId(), p.getPermissionCode(),
                p.isGranted(), p.getGrantedByUserId(), p.getGrantedAt());
    }
}

