package sy.gov.sla.organization.api;

import sy.gov.sla.organization.domain.DepartmentType;

public record CourtDto(Long id, Long branchId, DepartmentType departmentType, String nameAr,
                       boolean chamberSupport, boolean active) {}

