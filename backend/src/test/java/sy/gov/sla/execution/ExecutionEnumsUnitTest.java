package sy.gov.sla.execution;

import org.junit.jupiter.api.Test;
import sy.gov.sla.execution.domain.ExecutionFileStatus;
import sy.gov.sla.execution.domain.ExecutionStepType;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Enums-only sanity checks for Phase 5 (D-028, D-031).
 */
class ExecutionEnumsUnitTest {

    @Test
    void executionFileStatusValuesAreExactlyAsDecided() {
        assertThat(ExecutionFileStatus.values()).containsExactlyInAnyOrder(
                ExecutionFileStatus.OPEN,
                ExecutionFileStatus.IN_PROGRESS,
                ExecutionFileStatus.CLOSED,
                ExecutionFileStatus.ARCHIVED
        );
    }

    @Test
    void executionStepTypeValuesAreExactlyAsDecided() {
        assertThat(ExecutionStepType.values()).containsExactlyInAnyOrder(
                ExecutionStepType.NOTICE_REQUEST,
                ExecutionStepType.NOTICE_ISSUED,
                ExecutionStepType.SEIZURE_REQUEST,
                ExecutionStepType.SEIZURE_PLACED,
                ExecutionStepType.PAYMENT_RECORDED,
                ExecutionStepType.ADMIN_ACTION,
                ExecutionStepType.CLOSURE,
                ExecutionStepType.OTHER
        );
    }
}

