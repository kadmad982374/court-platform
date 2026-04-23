package sy.gov.sla.identity.application;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.api.CourtAccessDto;
import sy.gov.sla.access.api.DelegatedPermissionDto;
import sy.gov.sla.access.api.DepartmentMembershipDto;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.Role;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.access.domain.UserRole;
import sy.gov.sla.access.infrastructure.RoleRepository;
import sy.gov.sla.access.infrastructure.UserCourtAccessRepository;
import sy.gov.sla.access.infrastructure.UserDelegatedPermissionRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.access.infrastructure.UserRoleRepository;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ConflictException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.identity.api.CreateUserRequest;
import sy.gov.sla.identity.api.UpdateUserRequest;
import sy.gov.sla.identity.api.UserAdminDto;
import sy.gov.sla.identity.api.UserSummaryDto;
import sy.gov.sla.identity.domain.User;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.infrastructure.BranchRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Mini-Phase B — User administration service.
 *
 * Implements the create / read / patch / list user-administration surface
 * documented in {@code BACKEND_GAP_PHASE11_USER_ADMIN.md}.
 *
 * Authorization: all four entry points require {@code CENTRAL_SUPERVISOR}.
 * Other roles are explicitly rejected — the conservative position chosen
 * for Mini-Phase B (see D-047 / D-048).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserAdminService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 20;

    /** Forbidden literal — matches {@code BootstrapAdminRunner} default seed. */
    static final String SEED_PASSWORD_LITERAL = "ChangeMe!2026";

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final UserCourtAccessRepository courtAccessRepo;
    private final UserDelegatedPermissionRepository delegatedRepo;
    private final BranchRepository branchRepo;
    private final DepartmentRepository departmentRepo;
    private final AuthorizationService authorizationService;
    private final PasswordEncoder passwordEncoder;

    // ============================================================
    // CREATE
    // ============================================================
    public Long create(CreateUserRequest req, Long actorUserId) {
        requireCentral(actorUserId);

        if (userRepository.existsByUsername(req.username())) {
            throw new ConflictException("USERNAME_TAKEN", "Username already taken: " + req.username());
        }
        if (userRepository.existsByMobileNumber(req.mobileNumber())) {
            throw new ConflictException("MOBILE_TAKEN", "Mobile number already taken");
        }
        if (req.initialPassword() == null || req.initialPassword().length() < 8) {
            throw new BadRequestException("WEAK_PASSWORD", "initialPassword must be at least 8 characters");
        }
        if (SEED_PASSWORD_LITERAL.equals(req.initialPassword())) {
            throw new BadRequestException("WEAK_PASSWORD",
                    "initialPassword must not be the bootstrap seed default");
        }
        validateBranchDept(req.defaultBranchId(), req.defaultDepartmentId());

        User u = User.builder()
                .username(req.username())
                .fullName(req.fullName())
                .mobileNumber(req.mobileNumber())
                .passwordHash(passwordEncoder.encode(req.initialPassword()))
                .active(req.active() == null || req.active())
                .locked(false)
                .defaultBranchId(req.defaultBranchId())
                .defaultDepartmentId(req.defaultDepartmentId())
                .createdAt(Instant.now())
                .build();
        Long newId = userRepository.save(u).getId();
        UserActionLog.action("created user '{}' (id #{}) — roles={}", req.username(), newId, List.of());
        return newId;
    }

    // ============================================================
    // GET (admin detail)
    // ============================================================
    @Transactional(readOnly = true)
    public UserAdminDto get(Long id, Long actorUserId) {
        requireCentral(actorUserId);
        User u = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));
        return toAdminDto(u);
    }

    // ============================================================
    // PATCH
    // ============================================================
    public UserAdminDto patch(Long id, UpdateUserRequest req, Long actorUserId) {
        requireCentral(actorUserId);
        User u = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));

        if (req.fullName() != null && !req.fullName().isBlank()) {
            u.setFullName(req.fullName());
        }
        if (req.mobileNumber() != null && !req.mobileNumber().equals(u.getMobileNumber())) {
            if (userRepository.existsByMobileNumber(req.mobileNumber())) {
                throw new ConflictException("MOBILE_TAKEN", "Mobile number already taken");
            }
            u.setMobileNumber(req.mobileNumber());
        }
        if (req.active() != null) {
            u.setActive(req.active());
        }
        UserActionLog.action("updated user #{} — active={}", id, u.isActive());
        return toAdminDto(u);
    }

    // ============================================================
    // LIST (paginated)
    // ============================================================
    @Transactional(readOnly = true)
    public PageResponse<UserSummaryDto> list(RoleType role, Long branchId, Long departmentId,
                                             Boolean active, String q,
                                             int page, int size, Long actorUserId) {
        requireCentral(actorUserId);
        if (size <= 0) size = DEFAULT_PAGE_SIZE;
        if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;
        if (page < 0) page = 0;

        Long roleId = null;
        if (role != null) {
            roleId = roleRepository.findByType(role)
                    .orElseThrow(() -> new BadRequestException("ROLE_NOT_FOUND", "Role not found: " + role))
                    .getId();
        }
        final Long roleIdF = roleId;
        final Long branchIdF = branchId;
        final Long departmentIdF = departmentId;
        final Boolean activeF = active;
        final String qF = q;

        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Specification<User> spec = (root, query, cb) -> {
            // make distinct when joining one-to-many child tables
            if (query != null) query.distinct(true);
            List<Predicate> ands = new ArrayList<>();
            if (activeF != null) ands.add(cb.equal(root.get("active"), activeF));
            if (qF != null && !qF.isBlank()) {
                String pattern = "%" + qF.trim().toLowerCase() + "%";
                ands.add(cb.or(
                        cb.like(cb.lower(root.get("fullName")), pattern),
                        cb.like(cb.lower(root.get("username")), pattern)
                ));
            }
            if (roleIdF != null) {
                // join via subquery on user_roles
                jakarta.persistence.criteria.Subquery<Long> sub = query.subquery(Long.class);
                jakarta.persistence.criteria.Root<UserRole> urRoot = sub.from(UserRole.class);
                sub.select(urRoot.get("userId"))
                        .where(cb.equal(urRoot.get("roleId"), roleIdF));
                ands.add(root.get("id").in(sub));
            }
            if (branchIdF != null || departmentIdF != null) {
                jakarta.persistence.criteria.Subquery<Long> sub = query.subquery(Long.class);
                jakarta.persistence.criteria.Root<sy.gov.sla.access.domain.UserDepartmentMembership> mRoot =
                        sub.from(sy.gov.sla.access.domain.UserDepartmentMembership.class);
                List<Predicate> mAnds = new ArrayList<>();
                mAnds.add(cb.isTrue(mRoot.get("active")));
                if (branchIdF != null) mAnds.add(cb.equal(mRoot.get("branchId"), branchIdF));
                if (departmentIdF != null) mAnds.add(cb.equal(mRoot.get("departmentId"), departmentIdF));
                sub.select(mRoot.get("userId")).where(cb.and(mAnds.toArray(new Predicate[0])));
                ands.add(root.get("id").in(sub));
            }
            return ands.isEmpty() ? cb.conjunction() : cb.and(ands.toArray(new Predicate[0]));
        };

        Page<User> p = userRepository.findAll(spec, pageable);
        List<UserSummaryDto> content = p.getContent().stream()
                .map(this::toSummaryDto)
                .toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(),
                p.getTotalElements(), p.getTotalPages());
    }

    // ============================================================
    // helpers
    // ============================================================
    private void requireCentral(Long actorUserId) {
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        if (!ctx.isCentralSupervisor()) {
            throw new ForbiddenException("Only CENTRAL_SUPERVISOR may administer users");
        }
    }

    private void validateBranchDept(Long branchId, Long departmentId) {
        if (departmentId != null && branchId == null) {
            throw new BadRequestException("BRANCH_DEPT_MISMATCH",
                    "departmentId requires a branchId");
        }
        if (branchId != null && !branchRepo.existsById(branchId)) {
            throw new BadRequestException("INVALID_BRANCH", "Branch not found: " + branchId);
        }
        if (departmentId != null && !departmentRepo.existsByIdAndBranchId(departmentId, branchId)) {
            throw new BadRequestException("BRANCH_DEPT_MISMATCH",
                    "Department " + departmentId + " does not belong to branch " + branchId);
        }
    }

    private UserSummaryDto toSummaryDto(User u) {
        return new UserSummaryDto(
                u.getId(), u.getUsername(), u.getFullName(), u.isActive(),
                u.getDefaultBranchId(), u.getDefaultDepartmentId(),
                rolesOf(u.getId()));
    }

    private UserAdminDto toAdminDto(User u) {
        Long uid = u.getId();
        List<DepartmentMembershipDto> memberships = membershipRepo.findByUserId(uid).stream()
                .map(m -> new DepartmentMembershipDto(m.getId(), m.getUserId(), m.getBranchId(),
                        m.getDepartmentId(), m.getMembershipType(), m.isPrimary(), m.isActive()))
                .toList();
        List<DelegatedPermissionDto> delegated = delegatedRepo.findByUserId(uid).stream()
                .map(p -> new DelegatedPermissionDto(p.getId(), p.getUserId(), p.getPermissionCode(),
                        p.isGranted(), p.getGrantedByUserId(), p.getGrantedAt()))
                .toList();
        List<CourtAccessDto> courts = courtAccessRepo.findByUserId(uid).stream()
                .map(c -> new CourtAccessDto(c.getId(), c.getUserId(), c.getCourtId(),
                        c.getGrantedByUserId(), c.getGrantedAt(), c.isActive()))
                .toList();
        return new UserAdminDto(
                uid, u.getUsername(), u.getFullName(), u.getMobileNumber(),
                u.isActive(), u.isLocked(),
                u.getDefaultBranchId(), u.getDefaultDepartmentId(),
                u.getCreatedAt(), u.getLastLoginAt(),
                rolesOf(uid), memberships, delegated, courts);
    }

    private List<RoleType> rolesOf(Long userId) {
        Map<Long, RoleType> roleCache = new HashMap<>();
        roleRepository.findAll().forEach(r -> roleCache.put(r.getId(), r.getType()));
        List<RoleType> out = new ArrayList<>();
        for (UserRole ur : userRoleRepository.findByUserId(userId)) {
            RoleType t = roleCache.get(ur.getRoleId());
            if (t != null) out.add(t);
        }
        return out;
    }
}

