package sy.gov.sla.litigationprogression.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.litigationprogression.domain.PostponementReason;

public interface PostponementReasonRepository extends JpaRepository<PostponementReason, String> {
}

