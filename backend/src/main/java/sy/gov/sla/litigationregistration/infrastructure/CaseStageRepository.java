package sy.gov.sla.litigationregistration.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.litigationregistration.domain.CaseStage;

import java.util.List;

public interface CaseStageRepository extends JpaRepository<CaseStage, Long> {
    List<CaseStage> findByLitigationCaseId(Long litigationCaseId);

    /** P3-01: bulk loader so {@code listCases} can fetch stages for a whole page
     *  in one query instead of one-per-case. */
    List<CaseStage> findByLitigationCaseIdIn(List<Long> litigationCaseIds);
}

