package sy.gov.sla.legallibrary.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sy.gov.sla.legallibrary.domain.LegalLibraryItem;

public interface LegalLibraryItemRepository
        extends JpaRepository<LegalLibraryItem, Long>,
                JpaSpecificationExecutor<LegalLibraryItem> {
}

