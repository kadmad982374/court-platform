package sy.gov.sla.access.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "user_court_access",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_court_access_user_court",
                columnNames = {"user_id", "court_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserCourtAccess {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "court_id", nullable = false)
    private Long courtId;

    @Column(name = "granted_by_user_id", nullable = false)
    private Long grantedByUserId;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    @Column(name = "is_active", nullable = false)
    private boolean active;
}

