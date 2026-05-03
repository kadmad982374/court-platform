package sy.gov.sla.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P7-01 — Unit tests for {@link JwtService}.
 * Documents current behavior (issue/parse round-trip, tampered → null, expired → null).
 * Wrong-issuer + clock-skew tests will tighten when P1-04 lands.
 */
class JwtServiceTest {

    private static final String VALID_SECRET_B64 =
            "ZGV2LW9ubHktc2VjcmV0LWtleS0zMmJ5dGVzLW1pbi0xMjM0NTY3ODkw"; // 32+ bytes after decode
    private static final String OTHER_SECRET_B64 =
            Base64.getEncoder().encodeToString(
                    "this-is-a-DIFFERENT-secret-32-bytes-min".getBytes());

    private JwtService newService() {
        return newService(VALID_SECRET_B64, "sla-test", 30, 14);
    }

    private JwtService newService(String secret, String issuer, long accessMin, long refreshDays) {
        JwtProperties props = new JwtProperties(secret, accessMin, refreshDays, issuer);
        return new JwtService(props);
    }

    @Nested
    @DisplayName("generateAccessToken / parse round-trip")
    class RoundTrip {

        @Test
        void valid_token_parses_back_to_same_claims() {
            JwtService svc = newService();
            String token = svc.generateAccessToken(42L, "alice", List.of("ADMIN_CLERK"));

            Claims c = svc.parse(token);

            assertThat(c).isNotNull();
            assertThat(svc.extractUserId(c)).isEqualTo(42L);
            assertThat(svc.extractUsername(c)).isEqualTo("alice");
            assertThat(svc.extractRoles(c)).containsExactly("ADMIN_CLERK");
        }

        @Test
        void empty_roles_round_trips_as_empty_list() {
            JwtService svc = newService();
            String token = svc.generateAccessToken(7L, "bob", List.of());

            Claims c = svc.parse(token);

            assertThat(svc.extractRoles(c)).isEmpty();
        }

        @Test
        void multiple_roles_preserved() {
            JwtService svc = newService();
            String token = svc.generateAccessToken(1L, "carol",
                    List.of("CENTRAL_SUPERVISOR", "BRANCH_HEAD"));

            Claims c = svc.parse(token);

            assertThat(svc.extractRoles(c))
                    .containsExactly("CENTRAL_SUPERVISOR", "BRANCH_HEAD");
        }
    }

    @Nested
    @DisplayName("parse rejects bad tokens")
    class Rejection {

        @Test
        void garbage_string_returns_null() {
            JwtService svc = newService();
            assertThat(svc.parse("not.a.jwt")).isNull();
        }

        @Test
        void empty_string_returns_null() {
            JwtService svc = newService();
            assertThat(svc.parse("")).isNull();
        }

        @Test
        void token_signed_with_other_secret_returns_null() {
            JwtService a = newService(VALID_SECRET_B64, "sla-test", 30, 14);
            JwtService b = newService(OTHER_SECRET_B64, "sla-test", 30, 14);
            String tokenFromB = b.generateAccessToken(1L, "x", List.of());

            assertThat(a.parse(tokenFromB)).isNull();
        }

        @Test
        void tampered_payload_returns_null() {
            JwtService svc = newService();
            String token = svc.generateAccessToken(1L, "x", List.of());
            // flip a character in the payload section
            String[] parts = token.split("\\.");
            String tampered = parts[0] + "." + parts[1].substring(0, parts[1].length() - 1) + "X." + parts[2];

            assertThat(svc.parse(tampered)).isNull();
        }

        @Test
        void already_expired_token_returns_null() {
            // Build a token whose `exp` is already in the past, signed with the same key.
            byte[] secretBytes = Base64.getDecoder().decode(VALID_SECRET_B64);
            SecretKey key = Keys.hmacShaKeyFor(secretBytes);
            String expiredToken = Jwts.builder()
                    .issuer("sla-test")
                    .subject("1")
                    .claim("username", "x")
                    .claim("roles", List.of())
                    .issuedAt(Date.from(Instant.now().minusSeconds(3600)))
                    .expiration(Date.from(Instant.now().minusSeconds(60)))
                    .signWith(key, Jwts.SIG.HS256)
                    .compact();

            JwtService svc = newService();
            assertThat(svc.parse(expiredToken)).isNull();
        }
    }

    @Nested
    @DisplayName("claim extractors")
    class Extractors {

        @Test
        void extractUsername_returns_null_when_claim_missing() {
            // Build a token without the "username" claim.
            byte[] secretBytes = Base64.getDecoder().decode(VALID_SECRET_B64);
            SecretKey key = Keys.hmacShaKeyFor(secretBytes);
            String token = Jwts.builder()
                    .issuer("sla-test")
                    .subject("99")
                    .issuedAt(Date.from(Instant.now()))
                    .expiration(Date.from(Instant.now().plusSeconds(300)))
                    .signWith(key, Jwts.SIG.HS256)
                    .compact();

            JwtService svc = newService();
            Claims c = svc.parse(token);

            assertThat(c).isNotNull();
            assertThat(svc.extractUsername(c)).isNull();
            assertThat(svc.extractUserId(c)).isEqualTo(99L);
            assertThat(svc.extractRoles(c)).isEmpty();
        }
    }
}
