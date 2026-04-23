package sy.gov.sla.identity.api;

import sy.gov.sla.access.api.CourtAccessDto;
import sy.gov.sla.access.api.DelegatedPermissionDto;
import sy.gov.sla.access.api.DepartmentMembershipDto;
import sy.gov.sla.access.domain.RoleType;

import java.util.List;

public record CurrentUserDto(
        Long id,
        String username,
        String fullName,
        String mobileNumber,
        boolean active,
        Long defaultBranchId,
        Long defaultDepartmentId,
        List<RoleType> roles,
        List<DepartmentMembershipDto> departmentMemberships,
        List<CourtAccessDto> courtAccess,
        List<DelegatedPermissionDto> delegatedPermissions
) {}

