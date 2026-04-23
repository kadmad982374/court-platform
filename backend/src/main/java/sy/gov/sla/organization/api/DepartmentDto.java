package sy.gov.sla.organization.api;

import sy.gov.sla.organization.domain.DepartmentType;

public record DepartmentDto(Long id, Long branchId, DepartmentType type, String nameAr, boolean active) {}

