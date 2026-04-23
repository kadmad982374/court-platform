package sy.gov.sla.legallibrary.api;

import java.time.Instant;
import java.time.LocalDate;

public record LegalLibraryItemDto(
        Long id,
        Long categoryId,
        String title,
        String summary,
        String bodyText,
        String keywords,
        String sourceReference,
        LocalDate publishedAt,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {}

