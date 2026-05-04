package sy.gov.sla.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * P1-09 + audit blocker #11 — per-IP rate-limit on the auth endpoints most
 * vulnerable to brute-force / SMS abuse:
 *
 *   POST /api/v1/auth/login              → {@value LOGIN_LIMIT}/min/IP
 *   POST /api/v1/auth/forgot-password    → {@value FORGOT_PWD_LIMIT}/min/IP
 *
 * Implementation is a fixed-window counter held in an in-memory
 * {@link ConcurrentHashMap}. Acceptable for single-instance demo / pilot
 * deploys; behind multiple backend replicas this will undercount because each
 * replica has its own bucket. Production-scale fix is either Bucket4j+Redis or
 * pushing the limiter to nginx ({@code limit_req_zone}) — both are noted as
 * follow-ups in PR-6's deployment hardening.
 *
 * Memory bound: each IP/path key adds ~80 bytes. The map self-prunes on every
 * write — windows older than 10× the current window are evicted to keep the
 * footprint bounded under sustained traffic.
 */
@Component
@Slf4j
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final int LOGIN_LIMIT = 10;       // generous: legit users + tab reloads
    private static final int FORGOT_PWD_LIMIT = 3;   // tighter: SMS cost protection

    private static final String LOGIN_PATH        = "/api/v1/auth/login";
    private static final String FORGOT_PWD_PATH   = "/api/v1/auth/forgot-password";

    private static final Duration EVICTION_HORIZON = WINDOW.multipliedBy(10);

    /** Visible for tests so they can clear state between cases. */
    final Map<String, Window> buckets = new ConcurrentHashMap<>();

    /** Killswitch — kept ON in prod / demo. Test profile sets it false in
     *  application-test.yml so MockMvc-driven multi-test runs aren't tripped
     *  by the in-memory bucket accumulating across test methods. */
    @Value("${sla.security.rate-limit.enabled:true}")
    private boolean enabled;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {

        if (!enabled) {
            chain.doFilter(req, res);
            return;
        }

        Integer limit = limitFor(req.getRequestURI());
        if (limit == null) {
            chain.doFilter(req, res);
            return;
        }

        String key = req.getRequestURI() + "|" + clientIp(req);
        if (!tryAcquire(key, limit)) {
            log.warn("rate-limit: blocked {} from {} (>{}/min)",
                    req.getRequestURI(), clientIp(req), limit);
            writeRejection(res);
            return;
        }
        chain.doFilter(req, res);
    }

    private static Integer limitFor(String path) {
        if (path == null) return null;
        if (path.endsWith(LOGIN_PATH))      return LOGIN_LIMIT;
        if (path.endsWith(FORGOT_PWD_PATH)) return FORGOT_PWD_LIMIT;
        return null;
    }

    private boolean tryAcquire(String key, int limit) {
        Instant now = Instant.now();
        evictStale(now);
        Window w = buckets.compute(key, (k, existing) -> {
            if (existing == null || !existing.resetAt().isAfter(now)) {
                return new Window(now.plus(WINDOW), new AtomicInteger(0));
            }
            return existing;
        });
        return w.count.incrementAndGet() <= limit;
    }

    /** Cheap O(n) sweep — only runs on writes, only removes truly old entries. */
    private void evictStale(Instant now) {
        if (buckets.size() < 1024) return;          // no-op until churn justifies it
        buckets.entrySet().removeIf(e ->
                e.getValue().resetAt().isBefore(now.minus(EVICTION_HORIZON)));
    }

    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            // First IP in the chain = original client.
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();
        return req.getRemoteAddr();
    }

    private static void writeRejection(HttpServletResponse res) throws IOException {
        res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setHeader("Retry-After", "60");
        res.getWriter().write(
                "{\"code\":\"RATE_LIMIT_EXCEEDED\","
                        + "\"message\":\"Too many requests. Try again later.\"}");
    }

    record Window(Instant resetAt, AtomicInteger count) {}
}
