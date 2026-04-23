package sy.gov.sla.decisionfinalization;

import org.junit.jupiter.api.Test;
import sy.gov.sla.decisionfinalization.domain.DecisionType;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * يتأكد أن قائمة DecisionType حصرية ومطابقة لـ D-009 — لا قيم زائدة ولا ناقصة.
 */
class DecisionTypeUnitTest {

    @Test
    void enumIsExclusiveAndExactlyAsDecided() {
        assertThat(DecisionType.values()).containsExactlyInAnyOrder(
                DecisionType.FOR_ENTITY,
                DecisionType.AGAINST_ENTITY,
                DecisionType.SETTLEMENT,
                DecisionType.NON_FINAL
        );
    }
}

