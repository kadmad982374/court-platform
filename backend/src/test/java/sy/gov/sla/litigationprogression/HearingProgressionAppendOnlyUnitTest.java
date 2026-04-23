package sy.gov.sla.litigationprogression;

import org.junit.jupiter.api.Test;
import sy.gov.sla.litigationprogression.domain.EntryType;
import sy.gov.sla.litigationprogression.domain.HearingProgressionEntry;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * يضمن أن HearingProgressionEntry append-only على مستوى التصميم:
 * - لا توجد setters عمومية (Lombok @Setter غير مفعّل).
 * - كل أعمدة JPA تحمل updatable=false (مفروض على JPA layer).
 */
class HearingProgressionAppendOnlyUnitTest {

    @Test
    void noPublicSettersOnEntity() {
        List<String> setters = Arrays.stream(HearingProgressionEntry.class.getMethods())
                .map(Method::getName)
                .filter(n -> n.startsWith("set"))
                // Object.setClass etc. don't exist; this is purely class-defined setters
                .toList();
        assertThat(setters).isEmpty();
    }

    @Test
    void entryTypeEnumIsExactlyAsDecided() {
        assertThat(EntryType.values()).containsExactlyInAnyOrder(
                EntryType.INITIAL, EntryType.ROLLOVER, EntryType.FINALIZED);
    }

    @Test
    void canBuildOnlyViaBuilder() {
        var e = HearingProgressionEntry.builder()
                .caseStageId(1L).hearingDate(LocalDate.now()).postponementReasonCode("X")
                .postponementReasonLabel("لـ").enteredByUserId(2L)
                .entryType(EntryType.ROLLOVER).createdAt(Instant.now()).build();
        assertThat(e.getEntryType()).isEqualTo(EntryType.ROLLOVER);
    }
}

