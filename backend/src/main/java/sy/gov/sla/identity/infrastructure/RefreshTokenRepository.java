package sy.gov.sla.identity.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.identity.domain.RefreshToken;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** P1-01: every active token in a rotation chain — used to revoke the
     *  whole family when a revoked predecessor is replayed. */
    List<RefreshToken> findByFamilyIdAndRevokedFalse(UUID familyId);

    /** P1-10: replaces {@code findAll() + filter} in resetPassword(). */
    List<RefreshToken> findByUserIdAndRevokedFalse(Long userId);
}

