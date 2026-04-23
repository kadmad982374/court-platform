package sy.gov.sla.access.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.access.domain.DelegatedPermissionCode;
import sy.gov.sla.access.domain.UserDelegatedPermission;

import java.util.List;
import java.util.Optional;

public interface UserDelegatedPermissionRepository extends JpaRepository<UserDelegatedPermission, Long> {
    List<UserDelegatedPermission> findByUserId(Long userId);
    Optional<UserDelegatedPermission> findByUserIdAndPermissionCode(Long userId, DelegatedPermissionCode code);
}

