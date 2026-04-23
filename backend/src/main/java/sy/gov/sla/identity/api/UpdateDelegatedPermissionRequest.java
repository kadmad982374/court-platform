package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotNull;

/** Mini-Phase B — body for {@code PATCH /api/v1/users/{id}/delegated-permissions/{pid}}. */
public record UpdateDelegatedPermissionRequest(@NotNull Boolean granted) {}

