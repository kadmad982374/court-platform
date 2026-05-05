package sy.gov.sla.access.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.UserDepartmentMembership;

import java.util.List;
import java.util.Optional;

public interface UserDepartmentMembershipRepository extends JpaRepository<UserDepartmentMembership, Long> {
    List<UserDepartmentMembership> findByUserId(Long userId);
    List<UserDepartmentMembership> findByUserIdAndActiveTrue(Long userId);

    /**
     * Mini-Phase A (D-046) — list memberships of a given type in a specific
     * department, filtered to active=true. Used by
     * {@code UserQueryService.listAssignableLawyers}.
     */
    List<UserDepartmentMembership> findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
            Long branchId, Long departmentId, MembershipType membershipType);

    /**
     * Mini-Phase B — duplicate detection for adding a department membership.
     * (department_id may be null for BRANCH_HEAD, hence two variants.)
     */
    Optional<UserDepartmentMembership> findFirstByUserIdAndBranchIdAndDepartmentIdAndMembershipType(
            Long userId, Long branchId, Long departmentId, MembershipType membershipType);

    Optional<UserDepartmentMembership> findFirstByUserIdAndBranchIdAndDepartmentIdIsNullAndMembershipType(
            Long userId, Long branchId, MembershipType membershipType);

    /**
     * PR-14 (customer feedback A-1 / Q-G expansion) — broadcast recipient
     * resolution. Branch-wide membership listing (used by ADMIN and
     * BRANCH_HEAD broadcasts).
     */
    List<UserDepartmentMembership> findByBranchIdAndMembershipTypeAndActiveTrue(
            Long branchId, MembershipType membershipType);

    /** PR-14 — system-wide membership listing (used by ADMIN's ALL broadcast). */
    List<UserDepartmentMembership> findByMembershipTypeAndActiveTrue(MembershipType membershipType);
}

