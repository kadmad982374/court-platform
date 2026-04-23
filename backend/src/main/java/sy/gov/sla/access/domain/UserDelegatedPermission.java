package sy.gov.sla.access.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "user_delegated_permissions",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_delegated_user_code",
                columnNames = {"user_id", "permission_code"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDelegatedPermission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "permission_code", nullable = false, length = 64)
    private DelegatedPermissionCode permissionCode;

    @Column(name = "granted", nullable = false)
    private boolean granted;

    @Column(name = "granted_by_user_id", nullable = false)
    private Long grantedByUserId;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;
}

