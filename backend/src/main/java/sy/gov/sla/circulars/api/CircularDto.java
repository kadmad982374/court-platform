package sy.gov.sla.circulars.api;

import sy.gov.sla.circulars.domain.CircularSourceType;

import java.time.Instant;
import java.time.LocalDate;

public record CircularDto(
        Long id,
        CircularSourceType sourceType,
        String title,
        String summary,
        String bodyText,
        LocalDate issueDate,
        String referenceNumber,
        String keywords,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {}

