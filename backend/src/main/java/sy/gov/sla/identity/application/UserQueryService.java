package sy.gov.sla.identity.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.api.CourtAccessDto;
import sy.gov.sla.access.api.DelegatedPermissionDto;
import sy.gov.sla.access.api.DepartmentMembershipDto;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.DelegatedPermissionCode;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.access.domain.UserDepartmentMembership;
import sy.gov.sla.access.infrastructure.*;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.identity.api.AssignableLawyerDto;
import sy.gov.sla.identity.api.CurrentUserDto;
import sy.gov.sla.identity.domain.User;
import sy.gov.sla.identity.infrastructure.UserRepository;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserQueryService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final UserCourtAccessRepository courtAccessRepo;
    private final UserDelegatedPermissionRepository delegatedRepo;
    private final AuthorizationService authorizationService;

    public CurrentUserDto getCurrentUser(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        List<RoleType> roles = userRoleRepository.findByUserId(userId).stream()
                .map(ur -> roleRepository.findById(ur.getRoleId()).map(r -> r.getType()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();

        List<DepartmentMembershipDto> memberships = membershipRepo.findByUserId(userId).stream()
                .map(m -> new DepartmentMembershipDto(m.getId(), m.getUserId(), m.getBranchId(),
                        m.getDepartmentId(), m.getMembershipType(), m.isPrimary(), m.isActive()))
                .toList();

        List<CourtAccessDto> courts = courtAccessRepo.findByUserId(userId).stream()
                .map(c -> new CourtAccessDto(c.getId(), c.getUserId(), c.getCourtId(),
                        c.getGrantedByUserId(), c.getGrantedAt(), c.isActive()))
                .toList();

        List<DelegatedPermissionDto> delegated = delegatedRepo.findByUserId(userId).stream()
                .map(p -> new DelegatedPermissionDto(p.getId(), p.getUserId(), p.getPermissionCode(),
                        p.isGranted(), p.getGrantedByUserId(), p.getGrantedAt()))
                .toList();

        return new CurrentUserDto(
                u.getId(), u.getUsername(), u.getFullName(), u.getMobileNumber(), u.isActive(),
                u.getDefaultBranchId(), u.getDefaultDepartmentId(),
                roles, memberships, courts, delegated
        );
    }

    // ============================================================
    // Mini-Phase A — Assign Lawyer (D-046)
    // ============================================================
    //
    // Endpoint contract:
    //   GET /api/v1/users
    //       ?branchId={Long}             (mandatory)
    //       &departmentId={Long}         (mandatory)
    //       &membershipType=STATE_LAWYER (optional, default STATE_LAWYER —
    //                                    only STATE_LAWYER supported in A)
    //       &activeOnly=true             (optional, default true)
    //
    // Authorization (conservative):
    //   - SECTION_HEAD with active membership in (branchId, departmentId)  → allowed
    //   - ADMIN_CLERK with active membership in (branchId, departmentId)
    //     AND delegated permission ASSIGN_LAWYER (granted=true)            → allowed
    //   - any other role (incl. CENTRAL_SUPERVISOR, BRANCH_HEAD,
    //     READ_ONLY_SUPERVISOR, SPECIAL_INSPECTOR, STATE_LAWYER)           → 403
    //
    // Result rows:
    //   - users with active=true (when activeOnly=true)
    //   - having a STATE_LAWYER membership active=true in (branchId, departmentId)
    //   - sorted by fullName asc (Arabic-collation tolerant)
    //
    // Reference: docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
    //            docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-046)
    public List<AssignableLawyerDto> listAssignableLawyers(
            Long actorUserId,
            Long branchId,
            Long departmentId,
            MembershipType membershipType,
            boolean activeOnly) {

        if (branchId == null) {
            throw new BadRequestException("MISSING_PARAMETER", "branchId is required");
        }
        if (departmentId == null) {
            throw new BadRequestException("MISSING_PARAMETER", "departmentId is required");
        }
        if (membershipType == null) {
            membershipType = MembershipType.STATE_LAWYER;
        }
        // D-046: Mini-Phase A supports STATE_LAWYER only. Any other value is rejected
        // explicitly so the endpoint cannot be used as a generic Users Admin lookup.
        if (membershipType != MembershipType.STATE_LAWYER) {
            throw new BadRequestException(
                    "UNSUPPORTED_MEMBERSHIP_TYPE",
                    "Only membershipType=STATE_LAWYER is supported in this endpoint");
        }

        AuthorizationContext actorCtx = authorizationService.loadContext(actorUserId);
        boolean allowed =
                actorCtx.isSectionHeadOf(branchId, departmentId)
                        || (actorCtx.isAdminClerkOf(branchId, departmentId)
                            && authorizationService.hasDelegatedPermission(
                                    actorUserId, DelegatedPermissionCode.ASSIGN_LAWYER));
        if (!allowed) {
            throw new ForbiddenException(
                    "Only the section head of the department, or an admin clerk "
                            + "with ASSIGN_LAWYER delegation, may list assignable lawyers");
        }

        List<UserDepartmentMembership> memberships = membershipRepo
                .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                        branchId, departmentId, membershipType);
        if (memberships.isEmpty()) return List.of();

        List<Long> userIds = memberships.stream()
                .map(UserDepartmentMembership::getUserId)
                .distinct()
                .toList();

        List<User> users = userRepository.findAllById(userIds);

        return users.stream()
                .filter(u -> !activeOnly || u.isActive())
                .sorted(Comparator.comparing(User::getFullName,
                        Comparator.nullsLast(String::compareTo)))
                .map(u -> new AssignableLawyerDto(
                        u.getId(), u.getFullName(), u.getUsername(), u.isActive()))
                .toList();
    }
}

