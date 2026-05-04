package sy.gov.sla.identity.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * P8b-01 fix — re-applies the dev-only seed SQL once the admin user exists.
 *
 * Background:
 * Flyway runs BEFORE the Spring beans (D-018), so on a brand-new database
 * {@code V20__dev_seed_test_users.sql} sees no {@code admin} user, RAISE NOTICEs,
 * exits silently, and Flyway records it as success. Without this runner the
 * dev users are NEVER created — every fresh deployment ships login-broken.
 *
 * This runner:
 *   1. Runs AFTER {@link BootstrapAdminRunner} (Order(10)) via Order(20).
 *   2. Skips silently when {@code sla.dev-seed.enabled=false}.
 *   3. Skips silently when no admin user is present (e.g. test profile, prod
 *      with bootstrap disabled).
 *   4. Re-executes the V20–V23 dev-seed SQL files via JdbcTemplate. They are
 *      already idempotent (each user insert is gated by a username lookup),
 *      so re-running on every boot is safe.
 *
 * Disable in production with {@code sla.dev-seed.enabled=false} (and the
 * dev-seed V20–V23 files should also be removed from the production image).
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class DevSeedRunner {

    /** Versioned migration files re-applied at boot. Versioned (NOT repeatable)
     *  because Flyway already recorded them; we re-run the *content* via plain
     *  JDBC, not via Flyway. The SQL is required to be idempotent. */
    private static final List<String> SEED_RESOURCES = List.of(
            "db/migration/V20__dev_seed_test_users.sql",
            "db/migration/V21__dev_seed_assign_lawyer.sql",
            "db/migration/V22__demo_seed_data.sql",
            "db/migration/V23__repair_dev_seed_role_links.sql"
    );

    @Bean
    @Order(20)
    public ApplicationRunner devSeedApplicationRunner(DevSeedProperties props,
                                                      JdbcTemplate jdbc) {
        return args -> {
            if (!props.enabled()) {
                log.info("Dev seed disabled (sla.dev-seed.enabled=false)");
                return;
            }
            // Anchor on admin: if there's no admin user, the dev seeds reference
            // its password hash and would fail. Skip silently.
            Integer adminCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE username = 'admin'", Integer.class);
            if (adminCount == null || adminCount == 0) {
                log.info("Dev seed: no admin user present, skipping");
                return;
            }

            for (String path : SEED_RESOURCES) {
                applySeed(jdbc, path);
            }
        };
    }

    private void applySeed(JdbcTemplate jdbc, String classpathRelPath) {
        Resource res = new ClassPathResource(classpathRelPath);
        if (!res.exists()) {
            log.warn("Dev seed: missing resource {}, skipping", classpathRelPath);
            return;
        }
        String sql;
        try (var in = res.getInputStream()) {
            sql = StreamUtils.copyToString(in, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Dev seed: failed to read {}: {}", classpathRelPath, e.getMessage());
            return;
        }
        try {
            jdbc.execute(sql);
            log.info("Dev seed: re-applied {}", classpathRelPath);
        } catch (Exception e) {
            // Don't fail boot — these are dev-only conveniences. Log and continue.
            log.warn("Dev seed: error applying {}: {}", classpathRelPath, e.getMessage());
        }
    }
}
