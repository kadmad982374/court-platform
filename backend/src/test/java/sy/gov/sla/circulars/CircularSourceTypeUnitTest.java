package sy.gov.sla.circulars;

import org.junit.jupiter.api.Test;
import sy.gov.sla.circulars.domain.CircularSourceType;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D-040 — Phase 7: مصادر التعاميم محصورة باثنين فقط.
 */
class CircularSourceTypeUnitTest {

    @Test
    void valuesAreExactlyAsDecided() {
        assertThat(CircularSourceType.values()).containsExactlyInAnyOrder(
                CircularSourceType.MINISTRY_OF_JUSTICE,
                CircularSourceType.STATE_LITIGATION_ADMINISTRATION);
    }
}

