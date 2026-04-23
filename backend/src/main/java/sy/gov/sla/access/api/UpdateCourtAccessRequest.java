package sy.gov.sla.access.api;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record UpdateCourtAccessRequest(@NotNull List<CourtAccessEntry> entries) {
    public record CourtAccessEntry(@NotNull Long courtId, @NotNull Boolean active) {}
}

