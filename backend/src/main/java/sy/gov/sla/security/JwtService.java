package sy.gov.sla.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Component
public class JwtService {

    private final JwtProperties props;
    private final SecretKey key;

    public JwtService(JwtProperties props) {
        this.props = props;
        byte[] secret = Base64.getDecoder().decode(props.secret());
        this.key = Keys.hmacShaKeyFor(secret);
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

    public Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        } catch (JwtException e) {
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

