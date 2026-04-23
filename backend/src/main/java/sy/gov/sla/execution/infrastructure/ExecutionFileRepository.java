package sy.gov.sla.execution.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sy.gov.sla.execution.domain.ExecutionFile;

public interface ExecutionFileRepository
        extends JpaRepository<ExecutionFile, Long>, JpaSpecificationExecutor<ExecutionFile> {

    boolean existsByBranchIdAndExecutionYearAndExecutionFileNumber(
            Long branchId, int executionYear, String executionFileNumber);
}

