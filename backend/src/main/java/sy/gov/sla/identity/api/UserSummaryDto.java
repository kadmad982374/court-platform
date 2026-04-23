package sy.gov.sla.identity.api;

import sy.gov.sla.access.domain.RoleType;

import java.util.List;

/**
 * Mini-Phase B — compact row used by the paginated list endpoint.
 * mobileNumber is intentionally excluded from the list view; admins can
 * fetch it from the detail endpoint.
 */
public record UserSummaryDto(
        Long id,
        String username,
        String fullName,
        boolean active,
        Long defaultBranchId,
        Long defaultDepartmentId,
        List<RoleType> roles
) {}

