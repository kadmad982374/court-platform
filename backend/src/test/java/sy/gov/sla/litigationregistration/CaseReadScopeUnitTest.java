package sy.gov.sla.litigationregistration;

import org.junit.jupiter.api.Test;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationContext.DepartmentMembership;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.RoleType;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit checks for read-scope (D-021) on AuthorizationService.canReadCase.
 * No DB / Spring required.
 */
class CaseReadScopeUnitTest {

    private final AuthorizationService svc = new AuthorizationService(null, null, null, null, null);

    private AuthorizationContext ctx(Set<RoleType> roles, Set<Long> branches,
                                     Set<DepartmentMembership> ms, Long uid) {
        return new AuthorizationContext(uid, roles, branches, ms, Set.of());
    }

    @Test
    void centralSeesAll() {
        var ctx = ctx(Set.of(RoleType.CENTRAL_SUPERVISOR), Set.of(), Set.of(), 1L);
        assertThat(svc.canReadCase(ctx, 10L, 100L, 999L)).isTrue();
    }

    @Test
    void branchHeadOnlyOwnBranch() {
        var ctx = ctx(Set.of(RoleType.BRANCH_HEAD), Set.of(7L), Set.of(), 2L);
        assertThat(svc.canReadCase(ctx, 7L, 70L, 999L)).isTrue();
        assertThat(svc.canReadCase(ctx, 8L, 80L, 999L)).isFalse();
    }

    @Test
    void sectionHeadOnlyOwnDepartment() {
        var m = new DepartmentMembership(7L, 70L, MembershipType.SECTION_HEAD, true);
        var ctx = ctx(Set.of(RoleType.SECTION_HEAD), Set.of(), Set.of(m), 3L);
        assertThat(svc.canReadCase(ctx, 7L, 70L, 999L)).isTrue();
        assertThat(svc.canReadCase(ctx, 7L, 71L, 999L)).isFalse();
    }

    @Test
    void stateLawyerOnlyOwnedCases() {
        var ctx = ctx(Set.of(RoleType.STATE_LAWYER), Set.of(), Set.of(), 5L);
        assertThat(svc.canReadCase(ctx, 7L, 70L, 5L)).isTrue();
        assertThat(svc.canReadCase(ctx, 7L, 70L, 6L)).isFalse();
    }

    @Test
    void unknownRoleSeesNothing() {
        var ctx = ctx(Set.of(), Set.of(), Set.of(), 9L);
        assertThat(svc.canReadCase(ctx, 1L, 1L, 9L)).isFalse();
    }
}

