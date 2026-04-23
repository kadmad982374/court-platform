package sy.gov.sla.attachments;

import org.junit.jupiter.api.Test;
import sy.gov.sla.attachments.domain.AttachmentScopeType;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D-036: نطاق المرفق محصور بثلاثة أنواع في Phase 6.
 */
class AttachmentScopeTypeUnitTest {

    @Test
    void valuesAreExactlyAsDecided() {
        assertThat(AttachmentScopeType.values()).containsExactlyInAnyOrder(
                AttachmentScopeType.CASE_STAGE,
                AttachmentScopeType.EXECUTION_FILE,
                AttachmentScopeType.EXECUTION_STEP);
    }
}

