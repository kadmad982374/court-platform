package sy.gov.sla.organization.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.organization.domain.Department;
import sy.gov.sla.organization.domain.DepartmentType;

import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    List<Department> findByBranchId(Long branchId);
    Optional<Department> findByBranchIdAndType(Long branchId, DepartmentType type);
    boolean existsByIdAndBranchId(Long id, Long branchId);
}

