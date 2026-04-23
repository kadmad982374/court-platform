package sy.gov.sla.identity.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sy.gov.sla.identity.domain.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByUsername(String username);
    Optional<User> findByMobileNumber(String mobileNumber);
    boolean existsByUsername(String username);
    boolean existsByMobileNumber(String mobileNumber);
}

