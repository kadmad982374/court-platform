package sy.gov.sla.publicentitydirectory.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.publicentitydirectory.domain.PublicEntityCategory;

import java.util.List;

public interface PublicEntityCategoryRepository
        extends JpaRepository<PublicEntityCategory, Long> {

    List<PublicEntityCategory> findAllByOrderBySortOrderAscIdAsc();

    List<PublicEntityCategory> findAllByActiveTrueOrderBySortOrderAscIdAsc();
}

