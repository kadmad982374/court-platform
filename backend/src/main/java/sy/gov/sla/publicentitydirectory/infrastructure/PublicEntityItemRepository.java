package sy.gov.sla.publicentitydirectory.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sy.gov.sla.publicentitydirectory.domain.PublicEntityItem;

public interface PublicEntityItemRepository
        extends JpaRepository<PublicEntityItem, Long>,
                JpaSpecificationExecutor<PublicEntityItem> {
}

