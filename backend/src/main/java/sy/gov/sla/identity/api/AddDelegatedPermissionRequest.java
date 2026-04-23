package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotNull;
import sy.gov.sla.access.domain.DelegatedPermissionCode;

/** Mini-Phase B — body for {@code POST /api/v1/users/{id}/delegated-permissions}. Idempotent upsert by {@code code}. */
public record AddDelegatedPermissionRequest(
        @NotNull DelegatedPermissionCode code,
        @NotNull Boolean granted
) {}

