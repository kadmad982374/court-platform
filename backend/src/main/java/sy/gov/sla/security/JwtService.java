package sy.gov.sla.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class JwtService {

    /** P1-15: shipped dev default. Refuse to start in prod profile if matches. */
    private static final String SHIPPED_DEV_DEFAULT_SECRET =
            "ZGV2LW9ubHktc2VjcmV0LWtleS0zMmJ5dGVzLW1pbi0xMjM0NTY3ODkw";

    private static final long CLOCK_SKEW_SECONDS = 30;

    private final JwtProperties props;
    private final Environment environment;
    private final SecretKey key;

    public JwtService(JwtProperties props, Environment environment) {
        this.props = props;
        this.environment = environment;
        byte[] secret = Base64.getDecoder().decode(props.secret());
        this.key = Keys.hmacShaKeyFor(secret);
    }

    /**
     * P1-15: enforce a non-default, sufficiently long JWT secret on startup.
     * - Prod profile + dev default → refuse to boot.
     * - Any profile + decoded length < 32 bytes → refuse to boot (HS256 weak key).
     * - Non-prod + dev default → loud WARN, allow boot.
     */
    @PostConstruct
    void validateSecret() {
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(props.secret());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(
                    "SLA_JWT_SECRET is not valid Base64 — fix the secret value.", ex);
        }
        if (decoded.length < 32) {
            throw new IllegalStateException(
                    "SLA_JWT_SECRET must Base64-decode to at least 32 bytes for HS256 (got "
                            + decoded.length + "). Refusing to start.");
        }
        if (SHIPPED_DEV_DEFAULT_SECRET.equals(props.secret())) {
            boolean isProdProfile = Arrays.stream(environment.getActiveProfiles())
                    .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));
            if (isProdProfile) {
                throw new IllegalStateException(
                        "SLA_JWT_SECRET is the shipped dev default and active profile is prod. "
                                + "Refusing to start. Set SLA_JWT_SECRET to a unique value.");
            }
            log.warn("⚠ JWT secret is the shipped dev default — acceptable for dev/demo/test only. "
                    + "Override SLA_JWT_SECRET before any production deploy.");
        }
    }

    public String generateAccessToken(Long userId, String username, List<String> roles) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(props.accessTokenTtlMinutes() * 60);
        return Jwts.builder()
                .issuer(props.issuer())
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * P1-03: log JwtException at WARN with type + message (never the token body)
     *        so failed-parse attempts are observable instead of silently swallowed.
     * P1-04: enforce issuer + 30s clock skew on every parse.
     */
    public Claims parse(String token) {
        // Empty / null input is treated the same as a parse failure — return
        // null rather than letting JJWT's `IllegalArgumentException` escape.
        // Mirrors the contract documented by JwtServiceTest$Rejection.
        if (token == null || token.isEmpty()) return null;
        try {
            return Jwts.parser()
                    .requireIssuer(props.issuer())
                    .clockSkewSeconds(CLOCK_SKEW_SECONDS)
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            // Token-content / signature failure (JwtException) or malformed /
            // empty input (IllegalArgumentException from JJWT's hasText assert).
            // Log type+message ONLY — never the raw token (might leak in shared
            // logs). The filter still treats the request as anonymous.
            log.warn("JWT parse rejected: type={} message={}",
                    e.getClass().getSimpleName(), e.getMessage());
            return null;
        }
    }

    public Long extractUserId(Claims c) {
        return Long.valueOf(c.getSubject());
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(Claims c) {
        Object o = c.get("roles");
        if (o instanceof List<?> list) return (List<String>) list;
        return List.of();
    }

    public String extractUsername(Claims c) {
        Object u = c.get("username");
        return u == null ? null : u.toString();
    }

    public Map<String, Object> stub() { return Map.of(); }
}
