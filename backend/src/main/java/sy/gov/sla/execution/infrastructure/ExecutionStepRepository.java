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

    /**
     * Customer feedback round-3 — the execution file's "الحالة" badge mirrors
     * the most-recent step's type. Sort by step_date then id so two steps on
     * the same day deterministically pick the one entered last.
     */
    java.util.Optional<ExecutionStep> findFirstByExecutionFileIdOrderByStepDateDescIdDesc(Long executionFileId);
}

