package sy.gov.sla.identity.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.identity.domain.RefreshToken;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
}

