package sy.gov.sla.execution;

import org.junit.jupiter.api.Test;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationContext.DepartmentMembership;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.execution.application.ExecutionScope;
import sy.gov.sla.execution.application.ExecutionScope.Kind;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit checks لـ Read scope على execution_files (D-032).
 * مرآة ResolvedRegisterScopeUnitTest مع فرق ownership = assigned_user_id.
 */
class ExecutionScopeUnitTest {

    private static AuthorizationContext ctx(Set<RoleType> roles, Set<Long> headBranches,
                                            Set<DepartmentMembership> memberships) {
        return new AuthorizationContext(99L, roles, headBranches, memberships, Set.of());
    }

    @Test
    void centralSupervisorGetsAll() {
        ExecutionScope s = ExecutionScope.from(
                ctx(Set.of(RoleType.CENTRAL_SUPERVISOR), Set.of(), Set.of()));
        assertThat(s.kind()).isEqualTo(Kind.ALL);
    }

    @Test
    void readOnlySupervisorGetsAll() {
        ExecutionScope s = ExecutionScope.from(
                ctx(Set.of(RoleType.READ_ONLY_SUPERVISOR), Set.of(), Set.of()));
        assertThat(s.kind()).isEqualTo(Kind.ALL);
    }

    @Test
    void branchHeadGetsBranches() {
        ExecutionScope s = ExecutionScope.from(
                ctx(Set.of(RoleType.BRANCH_HEAD), Set.of(7L), Set.of()));
        assertThat(s.kind()).isEqualTo(Kind.BRANCHES);
        assertThat(s.branchIds()).containsExactly(7L);
    }

    @Test
    void sectionHeadGetsBranchDeptPair() {
        ExecutionScope s = ExecutionScope.from(ctx(
                Set.of(RoleType.SECTION_HEAD), Set.of(),
                Set.of(new DepartmentMembership(3L, 30L, MembershipType.SECTION_HEAD, true))));
        assertThat(s.kind()).isEqualTo(Kind.BRANCH_DEPT_PAIRS);
        long expected = ExecutionScope.encodeBranchDeptKey(3L, 30L);
        assertThat(s.branchDeptKeys()).containsExactly(expected);
    }

    @Test
    void clerkInactiveMembershipDoesNotCount() {
        ExecutionScope s = ExecutionScope.from(ctx(
                Set.of(RoleType.ADMIN_CLERK), Set.of(),
                Set.of(new DepartmentMembership(3L, 30L, MembershipType.ADMIN_CLERK, false))));
        assertThat(s.kind()).isEqualTo(Kind.NONE);
    }

    @Test
    void stateLawyerWithoutMembershipsGetsAssignedScope() {
        ExecutionScope s = ExecutionScope.from(
                ctx(Set.of(RoleType.STATE_LAWYER), Set.of(), Set.of()));
        assertThat(s.kind()).isEqualTo(Kind.ASSIGNED_USER);
        assertThat(s.assignedUserId()).isEqualTo(99L);
    }

    @Test
    void noRolesGivesNone() {
        ExecutionScope s = ExecutionScope.from(ctx(Set.of(), Set.of(), Set.of()));
        assertThat(s.kind()).isEqualTo(Kind.NONE);
    }

    @Test
    void matchesAllAlwaysTrue() {
        assertThat(ExecutionScope.all().matches(1L, 2L, 3L)).isTrue();
    }

    @Test
    void matchesNoneAlwaysFalse() {
        assertThat(ExecutionScope.none().matches(1L, 2L, 3L)).isFalse();
    }

    @Test
    void matchesBranchesOnlyWithinBranches() {
        ExecutionScope s = ExecutionScope.branches(Set.of(1L, 2L));
        assertThat(s.matches(2L, 99L, null)).isTrue();
        assertThat(s.matches(7L, 99L, null)).isFalse();
    }

    @Test
    void matchesBranchDeptPair() {
        long key = ExecutionScope.encodeBranchDeptKey(3L, 30L);
        ExecutionScope s = ExecutionScope.branchDeptPairs(Set.of(key));
        assertThat(s.matches(3L, 30L, null)).isTrue();
        assertThat(s.matches(3L, 31L, null)).isFalse();
        assertThat(s.matches(4L, 30L, null)).isFalse();
    }

    @Test
    void matchesAssignedRequiresEqualUser() {
        ExecutionScope s = ExecutionScope.assigned(99L);
        assertThat(s.matches(1L, 2L, 99L)).isTrue();
        assertThat(s.matches(1L, 2L, 100L)).isFalse();
        assertThat(s.matches(1L, 2L, null)).isFalse();
    }

    @Test
    void precedenceBranchHeadOverSectionHead() {
        ExecutionScope s = ExecutionScope.from(ctx(
                Set.of(RoleType.BRANCH_HEAD, RoleType.SECTION_HEAD), Set.of(7L),
                Set.of(new DepartmentMembership(3L, 30L, MembershipType.SECTION_HEAD, true))));
        assertThat(s.kind()).isEqualTo(Kind.BRANCHES);
    }
}

