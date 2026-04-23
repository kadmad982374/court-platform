package sy.gov.sla.legallibrary;

import org.junit.jupiter.api.Test;
import sy.gov.sla.legallibrary.domain.LegalCategory;
import sy.gov.sla.legallibrary.domain.LegalLibraryItem;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 7 — D-040: التحقق من القيم الافتراضية للنموذج البسيط للمكتبة القانونية.
 */
class LegalLibraryDomainUnitTest {

    @Test
    void categoryDefaultsAreSane() {
        LegalCategory c = LegalCategory.builder()
                .code("X").nameAr("اسم").active(true).sortOrder(0).build();
        assertThat(c.isActive()).isTrue();
        assertThat(c.getParentId()).isNull();
        assertThat(c.getCode()).isEqualTo("X");
    }

    @Test
    void itemKeepsAllRequiredFields() {
        Instant now = Instant.now();
        LegalLibraryItem it = LegalLibraryItem.builder()
                .categoryId(1L).title("t").bodyText("b")
                .active(true).createdAt(now).updatedAt(now).build();
        assertThat(it.getTitle()).isEqualTo("t");
        assertThat(it.getBodyText()).isEqualTo("b");
        assertThat(it.isActive()).isTrue();
    }
}

