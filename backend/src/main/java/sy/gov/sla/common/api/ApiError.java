package sy.gov.sla.common.api;

import java.time.Instant;
import java.util.List;

public record ApiError(
        String code,
        String message,
        List<FieldErrorEntry> details,
        Instant timestamp
) {
    public static ApiError of(String code, String message) {
        return new ApiError(code, message, List.of(), Instant.now());
    }
    public static ApiError of(String code, String message, List<FieldErrorEntry> details) {
        return new ApiError(code, message, details == null ? List.of() : details, Instant.now());
    }

    public record FieldErrorEntry(String field, String message) {}
}

