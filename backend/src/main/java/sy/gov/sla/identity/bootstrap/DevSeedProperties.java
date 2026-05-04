package sy.gov.sla.identity.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Toggle for {@link DevSeedRunner}. Disabled by default in any environment that
 * sets {@code sla.dev-seed.enabled=false} (production should). Demo/dev leave it
 * enabled so the test users are present after a fresh boot.
 */
@ConfigurationProperties(prefix = "sla.dev-seed")
public record DevSeedProperties(boolean enabled) {}
