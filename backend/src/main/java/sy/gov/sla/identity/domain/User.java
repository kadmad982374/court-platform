package sy.gov.sla.identity.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_users_username", columnNames = "username"),
                @UniqueConstraint(name = "uk_users_mobile_number", columnNames = "mobile_number")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(name = "mobile_number", nullable = false, length = 32)
    private String mobileNumber;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "is_locked", nullable = false)
    private boolean locked;

    @Column(name = "default_branch_id")
    private Long defaultBranchId;

    @Column(name = "default_department_id")
    private Long defaultDepartmentId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    /** Optimistic-lock counter. Hibernate increments on every UPDATE.
     *  Concurrent updates on the same row throw OptimisticLockException —
     *  prevents lost updates on `is_active`, password resets, last_login_at,
     *  and the upcoming P1-06 failed-login counters. */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;
}

