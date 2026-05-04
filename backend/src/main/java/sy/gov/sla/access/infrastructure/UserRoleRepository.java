package sy.gov.sla.access.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.access.domain.UserRole;

import java.util.List;
import java.util.Optional;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {
    List<UserRole> findByUserId(Long userId);
    Optional<UserRole> findByUserIdAndRoleId(Long userId, Long roleId);
    /** Mini-Phase B — used by user_role_admin only. */
    void deleteByUserIdAndRoleId(Long userId, Long roleId);
    List<UserRole> findByRoleId(Long roleId);

    /** P3-02: bulk loader so {@code UserAdminService.list} can fetch role
     *  assignments for a whole page in one query instead of one-per-user. */
    List<UserRole> findByUserIdIn(List<Long> userIds);
}

