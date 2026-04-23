package sy.gov.sla.decisionfinalization.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.decisionfinalization.domain.CaseDecision;

import java.util.Optional;

public interface CaseDecisionRepository extends JpaRepository<CaseDecision, Long> {
    Optional<CaseDecision> findByCaseStageId(Long caseStageId);
    boolean existsByCaseStageId(Long caseStageId);
}

