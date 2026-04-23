package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotNull;

/** Mini-Phase B — body for {@code POST /api/v1/users/{id}/court-access}. */
public record AddCourtAccessRequest(@NotNull Long courtId) {}

