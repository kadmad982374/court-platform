package sy.gov.sla.access.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_roles",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_roles_user_role",
                columnNames = {"user_id", "role_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserRole {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "role_id", nullable = false)
    private Long roleId;
}

