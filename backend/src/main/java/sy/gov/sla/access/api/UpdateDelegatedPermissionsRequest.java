package sy.gov.sla.access.api;

import jakarta.validation.constraints.NotNull;
import sy.gov.sla.access.domain.DelegatedPermissionCode;

import java.util.List;

public record UpdateDelegatedPermissionsRequest(@NotNull List<Entry> entries) {
    public record Entry(@NotNull DelegatedPermissionCode code, @NotNull Boolean granted) {}
}

