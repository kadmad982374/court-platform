package sy.gov.sla.identity.api;

public record TokenPairResponse(String accessToken, String refreshToken, long expiresInSeconds) {}

