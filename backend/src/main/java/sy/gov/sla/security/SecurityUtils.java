package sy.gov.sla.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import sy.gov.sla.common.exception.ForbiddenException;

public final class SecurityUtils {
    private SecurityUtils() {}

    public static CurrentUser currentUserOrThrow() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || !(a.getPrincipal() instanceof CurrentUser cu)) {
            throw new ForbiddenException("Not authenticated");
        }
        return cu;
    }
}

