package sy.gov.sla.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P7-02 — Unit tests for {@link JwtAuthenticationFilter}.
 * Documents current behavior:
 *   - valid token  → SecurityContext populated, MDC set, then cleaned up.
 *   - no token     → anonymous (SecurityContext empty), MDC NOT touched.
 *   - bad token    → anonymous (parser returns null today; this is the silent-swallow
 *                     P1-03 issue — test pins current behavior so we notice when it
 *                     changes).
 */
class JwtAuthenticationFilterTest {

    private static final String VALID_SECRET_B64 =
            "ZGV2LW9ubHktc2VjcmV0LWtleS0zMmJ5dGVzLW1pbi0xMjM0NTY3ODkw";

    private JwtService jwtService;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties(VALID_SECRET_B64, 30, 14, "sla-test");
        jwtService = new JwtService(props);
        filter = new JwtAuthenticationFilter(jwtService);
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    @DisplayName("valid Bearer token populates SecurityContext + MDC, then clears MDC")
    void valid_token_authenticates_and_clears_mdc() throws ServletException, IOException {
        String token = jwtService.generateAccessToken(11L, "alice", List.of("STATE_LAWYER"));
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse res = new MockHttpServletResponse();

        AtomicBoolean mdcSeenInsideChain = new AtomicBoolean(false);
        AtomicBoolean authSeenInsideChain = new AtomicBoolean(false);
        FilterChain chain = (HttpServletRequest q, HttpServletResponse s) -> {
            mdcSeenInsideChain.set("alice".equals(MDC.get("username"))
                    && "11".equals(MDC.get("userId")));
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            authSeenInsideChain.set(auth != null && auth.isAuthenticated()
                    && auth.getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().equals("ROLE_STATE_LAWYER")));
        };

        filter.doFilter(req, res, chain);

        assertThat(authSeenInsideChain).as("auth visible to downstream chain").isTrue();
        assertThat(mdcSeenInsideChain).as("MDC populated for downstream chain").isTrue();
        // After the filter completes, MDC keys it set must be cleared.
        assertThat(MDC.get("username")).isNull();
        assertThat(MDC.get("userId")).isNull();
        assertThat(MDC.get("role")).isNull();
    }

    @Test
    @DisplayName("no Authorization header → anonymous, MDC untouched")
    void no_header_leaves_context_anonymous() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);
        FilterChain chain = (q, s) -> called.set(true);

        filter.doFilter(req, res, chain);

        assertThat(called).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(MDC.get("username")).isNull();
    }

    @Test
    @DisplayName("non-Bearer Authorization scheme is ignored")
    void basic_auth_header_ignored() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Basic dXNlcjpwYXNz");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = (q, s) -> { /* no-op */ };

        filter.doFilter(req, res, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("malformed Bearer token → anonymous (currently silently swallowed; P1-03 will tighten)")
    void malformed_token_leaves_context_anonymous() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer not.a.real.jwt");
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);
        FilterChain chain = (q, s) -> called.set(true);

        filter.doFilter(req, res, chain);

        // Chain still runs (filter never short-circuits) → 401 lands later via Spring Security.
        assertThat(called).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("token with empty roles list still authenticates with no authorities")
    void empty_roles_authenticates_without_authorities() throws ServletException, IOException {
        String token = jwtService.generateAccessToken(5L, "viewer", List.of());
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = (q, s) -> { /* no-op */ };

        filter.doFilter(req, res, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities()).isEmpty();
        // role MDC key is only set when there are roles; verify it stays absent.
        assertThat(MDC.get("role")).isNull();
    }
}
