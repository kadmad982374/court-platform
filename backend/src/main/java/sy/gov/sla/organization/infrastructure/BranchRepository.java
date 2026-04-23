package sy.gov.sla.organization.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.organization.domain.Branch;

import java.util.Optional;

public interface BranchRepository extends JpaRepository<Branch, Long> {
    Optional<Branch> findByCode(String code);
}

