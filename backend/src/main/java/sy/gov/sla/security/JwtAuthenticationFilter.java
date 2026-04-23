package sy.gov.sla.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        boolean mdcSet = false;
        try {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                String token = header.substring(7);
                Claims claims = jwtService.parse(token);
                if (claims != null) {
                    Long userId = jwtService.extractUserId(claims);
                    String username = jwtService.extractUsername(claims);
                    List<String> roles = jwtService.extractRoles(claims);
                    List<SimpleGrantedAuthority> authorities = roles.stream()
                            .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                            .toList();
                    CurrentUser principal = new CurrentUser(userId, username);
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(principal, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);

                    // Populate MDC so every log line inside this request carries who is acting.
                    MDC.put("username", username);
                    MDC.put("userId", String.valueOf(userId));
                    if (!roles.isEmpty()) MDC.put("role", String.join(",", roles));
                    mdcSet = true;
                }
            }
            chain.doFilter(request, response);
        } finally {
            if (mdcSet) {
                MDC.remove("username");
                MDC.remove("userId");
                MDC.remove("role");
            }
        }
    }
}

