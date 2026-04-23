package sy.gov.sla.identity.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sla.bootstrap.central-supervisor")
public record BootstrapAdminProperties(
        boolean enabled,
        String username,
        String fullName,
        String mobileNumber,
        String initialPassword
) {}

