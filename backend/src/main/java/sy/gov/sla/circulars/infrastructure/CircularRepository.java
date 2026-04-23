package sy.gov.sla.circulars.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sy.gov.sla.circulars.domain.Circular;

public interface CircularRepository
        extends JpaRepository<Circular, Long>,
                JpaSpecificationExecutor<Circular> {
}

