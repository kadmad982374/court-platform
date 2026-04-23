package sy.gov.sla.access.api;

import sy.gov.sla.access.domain.MembershipType;

public record DepartmentMembershipDto(
        Long id, Long userId, Long branchId, Long departmentId,
        MembershipType membershipType, boolean primary, boolean active) {}

