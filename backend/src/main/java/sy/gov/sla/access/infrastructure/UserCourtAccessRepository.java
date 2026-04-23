package sy.gov.sla.access.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.access.domain.UserCourtAccess;

import java.util.List;
import java.util.Optional;

public interface UserCourtAccessRepository extends JpaRepository<UserCourtAccess, Long> {
    List<UserCourtAccess> findByUserId(Long userId);
    Optional<UserCourtAccess> findByUserIdAndCourtId(Long userId, Long courtId);
    boolean existsByUserIdAndCourtIdAndActiveTrue(Long userId, Long courtId);
}

