package sy.gov.sla.organization.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.organization.domain.Court;
import sy.gov.sla.organization.domain.DepartmentType;

import java.util.List;

public interface CourtRepository extends JpaRepository<Court, Long> {
    List<Court> findByBranchId(Long branchId);
    List<Court> findByBranchIdAndDepartmentType(Long branchId, DepartmentType departmentType);
    List<Court> findByDepartmentType(DepartmentType departmentType);
}

