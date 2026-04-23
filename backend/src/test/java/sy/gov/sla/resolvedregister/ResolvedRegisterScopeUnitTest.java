package sy.gov.sla.resolvedregister;

import org.junit.jupiter.api.Test;
import sy.gov.sla.resolvedregister.infrastructure.ResolvedRegisterQueryDao.ScopeFilter;
import sy.gov.sla.resolvedregister.infrastructure.ResolvedRegisterQueryDao.ScopeFilter.Kind;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit checks لقواعد scope filter في سجل الفصل (D-021/D-025).
 */
class ResolvedRegisterScopeUnitTest {

    @Test
    void allFactoryGivesAllKind() {
        ScopeFilter f = ScopeFilter.all();
        assertThat(f.kind()).isEqualTo(Kind.ALL);
    }

    @Test
    void noneFactoryGivesNoneKind() {
        ScopeFilter f = ScopeFilter.none();
        assertThat(f.kind()).isEqualTo(Kind.NONE);
    }

    @Test
    void branchesFactoryCarriesIds() {
        ScopeFilter f = ScopeFilter.branches(Set.of(1L, 2L));
        assertThat(f.kind()).isEqualTo(Kind.BRANCHES);
        assertThat(f.branchIds()).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void branchDeptKeysFactoryEncodesPair() {
        long key = 7L * 1_000_000L + 70L;
        ScopeFilter f = ScopeFilter.branchDeptPairs(Set.of(key));
        assertThat(f.kind()).isEqualTo(Kind.BRANCH_DEPT_PAIRS);
        assertThat(f.branchDeptKeys()).containsExactly(key);
    }

    @Test
    void ownerFactoryCarriesUserId() {
        ScopeFilter f = ScopeFilter.owner(99L);
        assertThat(f.kind()).isEqualTo(Kind.OWNER_USER);
        assertThat(f.ownerUserId()).isEqualTo(99L);
    }
}

