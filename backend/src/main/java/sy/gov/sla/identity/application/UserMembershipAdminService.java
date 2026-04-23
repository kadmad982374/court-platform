package sy.gov.sla.identity.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.api.DepartmentMembershipDto;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.UserDepartmentMembership;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ConflictException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.identity.api.CreateMembershipRequest;
import sy.gov.sla.identity.api.UpdateMembershipRequest;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.infrastructure.BranchRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;

/**
 * Mini-Phase B — manage department memberships of a user.
 *
 * <p>Authorization:
 * <ul>
 *   <li>{@code CENTRAL_SUPERVISOR} may add/update memberships in any branch.</li>
 *   <li>A branch's {@code BRANCH_HEAD} may add/update memberships only within
 *       his own branch.</li>
 *   <li>Anyone else: 403.</li>
 * </ul>
 *
 * <p>D-048: a non-central caller may never create a membership of type
 * {@link MembershipType#BRANCH_HEAD} → {@code BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD}.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserMembershipAdminService {

    private final UserRepository userRepository;
    private final BranchRepository branchRepo;
    private final DepartmentRepository departmentRepo;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final AuthorizationService authorizationService;

    public DepartmentMembershipDto add(Long userId, CreateMembershipRequest req, Long actorUserId) {
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }
        validateBranchAndDept(req.membershipType(), req.branchId(), req.departmentId());
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireScope(actor, req.branchId(), req.membershipType());

        boolean dup = (req.departmentId() == null
                ? membershipRepo.findFirstByUserIdAndBranchIdAndDepartmentIdIsNullAndMembershipType(
                        userId, req.branchId(), req.membershipType()).isPresent()
                : membershipRepo.findFirstByUserIdAndBranchIdAndDepartmentIdAndMembershipType(
                        userId, req.branchId(), req.departmentId(), req.membershipType()).isPresent());
        if (dup) {
            throw new ConflictException("DUPLICATE_MEMBERSHIP",
                    "Membership already exists for this user/branch/department/type");
        }

        UserDepartmentMembership saved = membershipRepo.save(UserDepartmentMembership.builder()
                .userId(userId)
                .branchId(req.branchId())
                .departmentId(req.departmentId())
                .membershipType(req.membershipType())
                .primary(req.primary() != null && req.primary())
                .active(req.active() == null || req.active())
                .build());
        return toDto(saved);
    }

    public DepartmentMembershipDto patch(Long userId, Long membershipId,
                                         UpdateMembershipRequest req, Long actorUserId) {
        UserDepartmentMembership m = membershipRepo.findById(membershipId)
                .orElseThrow(() -> new NotFoundException("Membership not found: " + membershipId));
        if (!m.getUserId().equals(userId)) {
            throw new NotFoundException("Membership not found for user " + userId);
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireScope(actor, m.getBranchId(), m.getMembershipType());

        if (req.active() != null)  m.setActive(req.active());
        if (req.primary() != null) m.setPrimary(req.primary());
        return toDto(m);
    }

    private void validateBranchAndDept(MembershipType type, Long branchId, Long departmentId) {
        if (!branchRepo.existsById(branchId)) {
            throw new BadRequestException("INVALID_BRANCH", "Branch not found: " + branchId);
        }
        if (type == MembershipType.BRANCH_HEAD) {
            if (departmentId != null) {
                throw new BadRequestException("INVALID_MEMBERSHIP",
                        "BRANCH_HEAD membership must not have a departmentId");
            }
        } else {
            if (departmentId == null) {
                throw new BadRequestException("INVALID_MEMBERSHIP",
                        "departmentId is required for membershipType=" + type);
            }
            if (!departmentRepo.existsByIdAndBranchId(departmentId, branchId)) {
                throw new BadRequestException("BRANCH_DEPT_MISMATCH",
                        "Department " + departmentId + " does not belong to branch " + branchId);
            }
        }
    }

    private void requireScope(AuthorizationContext actor, Long branchId, MembershipType type) {
        if (actor.isCentralSupervisor()) return;
        if (type == MembershipType.BRANCH_HEAD) {
            // D-048: only central can create/manage BRANCH_HEAD memberships.
            throw new ForbiddenException("BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD",
                    "Only CENTRAL_SUPERVISOR may create or update a BRANCH_HEAD membership");
        }
        if (actor.isBranchHeadOf(branchId)) return;
        throw new ForbiddenException("Not allowed to manage memberships in this branch");
    }

    private DepartmentMembershipDto toDto(UserDepartmentMembership m) {
        return new DepartmentMembershipDto(m.getId(), m.getUserId(), m.getBranchId(),
                m.getDepartmentId(), m.getMembershipType(), m.isPrimary(), m.isActive());
    }
}

