package sy.gov.sla.common.api;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PageResponseTest {

    @Test
    void record_holds_all_paging_fields() {
        PageResponse<String> p = new PageResponse<>(
                List.of("a", "b", "c"),
                /* page */ 1,
                /* size */ 10,
                /* totalElements */ 23L,
                /* totalPages */ 3
        );

        assertThat(p.content()).containsExactly("a", "b", "c");
        assertThat(p.page()).isEqualTo(1);
        assertThat(p.size()).isEqualTo(10);
        assertThat(p.totalElements()).isEqualTo(23L);
        assertThat(p.totalPages()).isEqualTo(3);
    }

    @Test
    void empty_page_is_representable() {
        PageResponse<Integer> p = new PageResponse<>(List.of(), 0, 25, 0L, 0);

        assertThat(p.content()).isEmpty();
        assertThat(p.totalElements()).isZero();
        assertThat(p.totalPages()).isZero();
    }

    @Test
    void records_with_same_field_values_are_equal() {
        PageResponse<String> a = new PageResponse<>(List.of("x"), 0, 25, 1L, 1);
        PageResponse<String> b = new PageResponse<>(List.of("x"), 0, 25, 1L, 1);

        assertThat(a).isEqualTo(b);
        assertThat(a).hasSameHashCodeAs(b);
    }
}
