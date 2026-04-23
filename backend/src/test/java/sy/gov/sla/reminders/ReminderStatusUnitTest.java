package sy.gov.sla.reminders;

import org.junit.jupiter.api.Test;
import sy.gov.sla.reminders.domain.ReminderStatus;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D-037: حالات التذكير محصورة بثلاث.
 */
class ReminderStatusUnitTest {

    @Test
    void valuesAreExactlyAsDecided() {
        assertThat(ReminderStatus.values()).containsExactlyInAnyOrder(
                ReminderStatus.PENDING,
                ReminderStatus.DONE,
                ReminderStatus.CANCELLED);
    }
}

