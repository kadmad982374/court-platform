package sy.gov.sla.execution.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.execution.domain.ExecutionStep;

import java.util.List;

/**
 * Append-only repository (D-031). الكشف يقتصر على الإدراج والقراءة المرتَّبة زمنيًا.
 * (deleteById/saveAll لتعديل موروثة من JpaRepository ولكن لا تُستخدم في أي مكان من
 * كود التطبيق ولا تُكشف عبر أي API.)
 */
public interface ExecutionStepRepository extends JpaRepository<ExecutionStep, Long> {

    List<ExecutionStep> findByExecutionFileIdOrderByStepDateAscIdAsc(Long executionFileId);

    long countByExecutionFileId(Long executionFileId);
}

