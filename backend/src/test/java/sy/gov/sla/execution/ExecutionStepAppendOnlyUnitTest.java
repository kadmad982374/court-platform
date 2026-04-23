package sy.gov.sla.execution;

import org.junit.jupiter.api.Test;
import sy.gov.sla.execution.domain.ExecutionStep;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * يضمن أن ExecutionStep append-only على مستوى المجال:
 *  - لا setters عمومية (Lombok @Setter غير مُفعَّل).
 *  - بناء عبر @Builder فقط.
 * مرجع: D-031 (مرآة D-022 لـ HearingProgressionEntry).
 */
class ExecutionStepAppendOnlyUnitTest {

    @Test
    void noPublicSettersOnEntity() {
        List<String> setters = Arrays.stream(ExecutionStep.class.getMethods())
                .map(Method::getName)
                .filter(n -> n.startsWith("set"))
                .toList();
        assertThat(setters).isEmpty();
    }

    @Test
    void canBuildOnlyViaBuilder() {
        ExecutionStep s = ExecutionStep.builder()
                .executionFileId(1L)
                .stepDate(LocalDate.now())
                .stepType(sy.gov.sla.execution.domain.ExecutionStepType.NOTICE_REQUEST)
                .stepDescription("طلب تبليغ")
                .createdByUserId(2L)
                .createdAt(Instant.now())
                .build();
        assertThat(s.getStepType())
                .isEqualTo(sy.gov.sla.execution.domain.ExecutionStepType.NOTICE_REQUEST);
        assertThat(s.getStepDescription()).isEqualTo("طلب تبليغ");
    }
}

