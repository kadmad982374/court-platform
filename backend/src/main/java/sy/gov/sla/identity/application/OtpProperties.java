package sy.gov.sla.identity.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sla.otp")
public record OtpProperties(int ttlMinutes, int length, int maxAttempts) {}

