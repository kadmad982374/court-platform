package sy.gov.sla.common.api;

import java.util.List;

/**
 * Generic page envelope used across read-oriented modules.
 * Introduced in Phase 7 for legal-library / public-entity-directory / circulars
 * (litigationregistration keeps its own historical record for backwards-compat).
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}

