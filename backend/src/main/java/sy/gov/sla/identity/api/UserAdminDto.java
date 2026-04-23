package sy.gov.sla.identity.api;

import sy.gov.sla.access.api.CourtAccessDto;
import sy.gov.sla.access.api.DelegatedPermissionDto;
import sy.gov.sla.access.api.DepartmentMembershipDto;
import sy.gov.sla.access.domain.RoleType;

import java.time.Instant;
import java.util.List;

/**
 * Mini-Phase B — admin-facing detail view of a user. Includes everything
 * an administrator needs to operate on the user (roles, memberships,
 * court access, delegations) but never exposes the password hash.
 */
public record UserAdminDto(
        Long id,
        String username,
        String fullName,
        String mobileNumber,
        boolean active,
        boolean locked,
        Long defaultBranchId,
        Long defaultDepartmentId,
        Instant createdAt,
        Instant lastLoginAt,
        List<RoleType> roles,
        List<DepartmentMembershipDto> departmentMemberships,
        List<DelegatedPermissionDto> delegatedPermissions,
        List<CourtAccessDto> courtAccess
) {}

