package sy.gov.sla.access.api;

import sy.gov.sla.access.domain.DelegatedPermissionCode;

import java.time.Instant;

public record DelegatedPermissionDto(
        Long id, Long userId, DelegatedPermissionCode code,
        boolean granted, Long grantedByUserId, Instant grantedAt) {}

