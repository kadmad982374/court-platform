package sy.gov.sla.common.api;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ApiErrorTest {

    @Test
    void of_two_arg_returns_empty_details_and_a_timestamp() {
        Instant before = Instant.now();
        ApiError e = ApiError.of("CODE_X", "human readable");
        Instant after = Instant.now();

        assertThat(e.code()).isEqualTo("CODE_X");
        assertThat(e.message()).isEqualTo("human readable");
        assertThat(e.details()).isEmpty();
        assertThat(e.timestamp()).isBetween(before, after);
    }

    @Test
    void of_with_details_preserves_them() {
        List<ApiError.FieldErrorEntry> details = List.of(
                new ApiError.FieldErrorEntry("username", "must not be blank"),
                new ApiError.FieldErrorEntry("password", "size must be between 8 and 64"));

        ApiError e = ApiError.of("VALIDATION_ERROR", "Validation failed", details);

        assertThat(e.code()).isEqualTo("VALIDATION_ERROR");
        assertThat(e.details()).hasSize(2);
        assertThat(e.details()).isEqualTo(details);
    }

    @Test
    void of_with_null_details_normalizes_to_empty_list() {
        ApiError e = ApiError.of("X", "y", null);

        assertThat(e.details()).isEmpty();
    }

    @Test
    void fieldErrorEntry_equality_is_value_based() {
        ApiError.FieldErrorEntry a = new ApiError.FieldErrorEntry("f", "m");
        ApiError.FieldErrorEntry b = new ApiError.FieldErrorEntry("f", "m");

        assertThat(a).isEqualTo(b).hasSameHashCodeAs(b);
    }
}
