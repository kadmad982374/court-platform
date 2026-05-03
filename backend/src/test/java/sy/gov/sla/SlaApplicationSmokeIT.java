package sy.gov.sla;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import sy.gov.sla.support.AbstractIntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P7-04 — Smoke test: ApplicationContext loads with application-test.yml + Flyway
 * migrations apply cleanly against the Testcontainers Postgres instance.
 *
 * Named *IT.java (run by failsafe) because it boots the full Spring context.
 */
class SlaApplicationSmokeIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void context_loads_with_test_profile() {
        assertThat(context).isNotNull();
        assertThat(context.getEnvironment().getActiveProfiles()).contains("test");
    }

    @Test
    void core_security_beans_present() {
        // Spot-check that the core security wiring registered.
        assertThat(context.getBean("jwtService")).isNotNull();
        assertThat(context.getBean("jwtAuthenticationFilter")).isNotNull();
    }
}
