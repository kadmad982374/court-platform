package sy.gov.sla.publicentitydirectory;

import org.junit.jupiter.api.Test;
import sy.gov.sla.publicentitydirectory.domain.PublicEntityCategory;
import sy.gov.sla.publicentitydirectory.domain.PublicEntityItem;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 7 — D-040: تحقّق بسيط من بنية كيانات دليل الجهات العامة.
 */
class PublicEntityDirectoryDomainUnitTest {

    @Test
    void categoryBuilderWorks() {
        PublicEntityCategory c = PublicEntityCategory.builder()
                .code("MINISTRIES").nameAr("الوزارات").active(true).sortOrder(10).build();
        assertThat(c.getCode()).isEqualTo("MINISTRIES");
        assertThat(c.isActive()).isTrue();
    }

    @Test
    void itemKeepsRequiredFields() {
        Instant now = Instant.now();
        PublicEntityItem it = PublicEntityItem.builder()
                .categoryId(1L).nameAr("وزارة العدل").active(true)
                .createdAt(now).updatedAt(now).build();
        assertThat(it.getNameAr()).isEqualTo("وزارة العدل");
        assertThat(it.isActive()).isTrue();
    }
}

