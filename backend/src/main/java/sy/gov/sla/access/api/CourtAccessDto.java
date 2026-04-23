package sy.gov.sla.access.api;

import java.time.Instant;

public record CourtAccessDto(
        Long id, Long userId, Long courtId,
        Long grantedByUserId, Instant grantedAt, boolean active) {}

