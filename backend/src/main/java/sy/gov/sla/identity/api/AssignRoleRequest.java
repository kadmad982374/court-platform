package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotNull;
import sy.gov.sla.access.domain.RoleType;

/** Mini-Phase B — body for {@code POST /api/v1/users/{id}/roles}. */
public record AssignRoleRequest(@NotNull RoleType role) {}

