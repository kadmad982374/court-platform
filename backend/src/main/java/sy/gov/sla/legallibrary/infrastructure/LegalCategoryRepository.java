package sy.gov.sla.legallibrary.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.legallibrary.domain.LegalCategory;

import java.util.List;

public interface LegalCategoryRepository extends JpaRepository<LegalCategory, Long> {

    List<LegalCategory> findAllByOrderBySortOrderAscIdAsc();

    List<LegalCategory> findAllByActiveTrueOrderBySortOrderAscIdAsc();
}

