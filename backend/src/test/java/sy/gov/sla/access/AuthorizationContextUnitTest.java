package sy.gov.sla.access;

import org.junit.jupiter.api.Test;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationContext.DepartmentMembership;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.RoleType;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests on the AuthorizationContext snapshot logic.
 * No DB / Spring required.
 */
class AuthorizationContextUnitTest {

    @Test
    void centralSupervisor_canReadAnything() {
        var ctx = new AuthorizationContext(1L, Set.of(RoleType.CENTRAL_SUPERVISOR),
                Set.of(), Set.of(), Set.of());
        assertThat(ctx.isCentralSupervisor()).isTrue();
        assertThat(ctx.isBranchHeadOf(99L)).isFalse();
    }

    @Test
    void sectionHeadMatchesOnlyHisDepartment() {
        var m = new DepartmentMembership(10L, 100L, MembershipType.SECTION_HEAD, true);
        var ctx = new AuthorizationContext(2L, Set.of(RoleType.SECTION_HEAD),
                Set.of(), Set.of(m), Set.of());
        assertThat(ctx.isSectionHeadOf(10L, 100L)).isTrue();
        assertThat(ctx.isSectionHeadOf(10L, 101L)).isFalse();
        assertThat(ctx.isSectionHeadOf(11L, 100L)).isFalse();
        assertThat(ctx.isAdminClerkOf(10L, 100L)).isFalse();
    }

    @Test
    void inactiveMembershipDoesNotGrantScope() {
        var m = new DepartmentMembership(10L, 100L, MembershipType.SECTION_HEAD, false);
        var ctx = new AuthorizationContext(3L, Set.of(RoleType.SECTION_HEAD),
                Set.of(), Set.of(m), Set.of());
        assertThat(ctx.isSectionHeadOf(10L, 100L)).isFalse();
    }

    @Test
    void branchHeadScope_isExact() {
        var ctx = new AuthorizationContext(4L, Set.of(RoleType.BRANCH_HEAD),
                Set.of(7L), Set.of(), Set.of());
        assertThat(ctx.isBranchHeadOf(7L)).isTrue();
        assertThat(ctx.isBranchHeadOf(8L)).isFalse();
    }
}

