package sy.gov.sla.access.application;

import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.RoleType;

import java.util.Set;

/**
 * لقطة (Snapshot) للسياق الأمني للمستخدم الحالي،
 * يبنيها AuthorizationService من الكيانات في DB.
 */
public record AuthorizationContext(
        Long userId,
        Set<RoleType> roles,
        /** فروع يكون المستخدم رئيسًا لها (BRANCH_HEAD). */
        Set<Long> headOfBranches,
        /** عضويات قسمية مفصّلة. */
        Set<DepartmentMembership> departmentMemberships,
        /** أرقام المحاكم الممنوحة فعليًا (active=true). */
        Set<Long> grantedCourtIds
) {
    public boolean isCentralSupervisor() { return roles.contains(RoleType.CENTRAL_SUPERVISOR); }
    public boolean isReadOnlySupervisor() { return roles.contains(RoleType.READ_ONLY_SUPERVISOR); }
    public boolean isSpecialInspector() { return roles.contains(RoleType.SPECIAL_INSPECTOR); }
    public boolean isBranchHeadOf(Long branchId) { return headOfBranches.contains(branchId); }
    public boolean isStateLawyer() { return roles.contains(RoleType.STATE_LAWYER); }

    /** True if the actor is an active STATE_LAWYER member of (branchId, departmentId). */
    public boolean isStateLawyerMemberOf(Long branchId, Long departmentId) {
        return roles.contains(RoleType.STATE_LAWYER) && departmentMemberships.stream().anyMatch(m ->
                m.active() && m.type() == MembershipType.STATE_LAWYER
                        && m.branchId().equals(branchId)
                        && departmentId != null && departmentId.equals(m.departmentId()));
    }

    public boolean isSectionHeadOf(Long branchId, Long departmentId) {
        return departmentMemberships.stream().anyMatch(m ->
                m.active() && m.type() == MembershipType.SECTION_HEAD
                        && m.branchId().equals(branchId)
                        && departmentId.equals(m.departmentId()));
    }

    public boolean isAdminClerkOf(Long branchId, Long departmentId) {
        return departmentMemberships.stream().anyMatch(m ->
                m.active() && m.type() == MembershipType.ADMIN_CLERK
                        && m.branchId().equals(branchId)
                        && departmentId.equals(m.departmentId()));
    }

    public record DepartmentMembership(
            Long branchId, Long departmentId, MembershipType type, boolean active
    ) {}
}

