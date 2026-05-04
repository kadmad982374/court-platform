package sy.gov.sla.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import sy.gov.sla.common.exception.ForbiddenException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityUtilsTest {

    @BeforeEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void clearAfter() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returns_currentUser_when_authentication_principal_is_CurrentUser() {
        CurrentUser cu = new CurrentUser(42L, "alice");
        var auth = new UsernamePasswordAuthenticationToken(
                cu, null, List.of(new SimpleGrantedAuthority("ROLE_STATE_LAWYER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        CurrentUser got = SecurityUtils.currentUserOrThrow();

        assertThat(got).isEqualTo(cu);
        assertThat(got.userId()).isEqualTo(42L);
        assertThat(got.username()).isEqualTo("alice");
    }

    @Test
    void throws_ForbiddenException_when_no_authentication() {
        // SecurityContext is empty.
        assertThatThrownBy(SecurityUtils::currentUserOrThrow)
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Not authenticated");
    }

    @Test
    void throws_ForbiddenException_when_anonymous() {
        var anon = new AnonymousAuthenticationToken(
                "key",
                "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        SecurityContextHolder.getContext().setAuthentication(anon);

        assertThatThrownBy(SecurityUtils::currentUserOrThrow)
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void throws_ForbiddenException_when_principal_is_a_string() {
        var auth = new UsernamePasswordAuthenticationToken(
                "alice", null, List.of(new SimpleGrantedAuthority("ROLE_X")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(SecurityUtils::currentUserOrThrow)
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void throws_ForbiddenException_when_authentication_is_marked_unauthenticated() {
        CurrentUser cu = new CurrentUser(1L, "alice");
        var auth = new UsernamePasswordAuthenticationToken(cu, null);
        // ctor without authorities marks the token as NOT authenticated.
        assertThat(auth.isAuthenticated()).isFalse();
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(SecurityUtils::currentUserOrThrow)
                .isInstanceOf(ForbiddenException.class);
    }
}
