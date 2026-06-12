package sy.gov.sla.pendingsubmission.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sy.gov.sla.pendingsubmission.domain.PendingSubmission;

public interface PendingSubmissionRepository
        extends JpaRepository<PendingSubmission, Long>,
                JpaSpecificationExecutor<PendingSubmission> {
}
