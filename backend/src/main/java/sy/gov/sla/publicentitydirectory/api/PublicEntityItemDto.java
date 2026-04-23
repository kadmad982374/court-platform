package sy.gov.sla.publicentitydirectory.api;

import java.time.Instant;

public record PublicEntityItemDto(
        Long id,
        Long categoryId,
        String nameAr,
        String shortDescription,
        String detailsText,
        String keywords,
        String referenceCode,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {}

