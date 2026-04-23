package sy.gov.sla.identity.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.identity.domain.PasswordResetCode;

import java.util.List;

public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, Long> {
    List<PasswordResetCode> findByUserIdAndConsumedFalse(Long userId);
}

