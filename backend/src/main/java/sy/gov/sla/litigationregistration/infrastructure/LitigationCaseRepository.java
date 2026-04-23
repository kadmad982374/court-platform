package sy.gov.sla.litigationregistration.infrastructure;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sy.gov.sla.litigationregistration.domain.LitigationCase;

public interface LitigationCaseRepository
        extends JpaRepository<LitigationCase, Long>, JpaSpecificationExecutor<LitigationCase> {
    Page<LitigationCase> findAll(Pageable pageable);
}

