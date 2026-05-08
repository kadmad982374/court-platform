package sy.gov.sla.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final AuthRateLimitFilter authRateLimitFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * P1-11 — env-driven CORS configuration.
     * <p>
     * Reads {@code sla.security.cors.allowed-origins} (comma-separated list).
     * Empty / unset → CORS is effectively disabled (same-origin via the nginx
     * proxy). Production must set {@code SLA_CORS_ALLOWED_ORIGINS=https://app.example.org}
     * explicitly. {@code allowCredentials=false} because JWT travels in the
     * {@code Authorization} header, not in cookies.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${sla.security.cors.allowed-origins:}") String allowedOriginsCsv) {
        CorsConfiguration cfg = new CorsConfiguration();
        if (allowedOriginsCsv != null && !allowedOriginsCsv.isBlank()) {
            List<String> origins = Arrays.stream(allowedOriginsCsv.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .toList();
            cfg.setAllowedOrigins(origins);
        }
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type",
                "X-Requested-With", "X-Forwarded-For"));
        cfg.setExposedHeaders(List.of("Content-Disposition"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                // P1-12 — explicit security headers on every backend response.
                // Nginx will layer additional headers for the SPA HTML it serves
                // (HSTS, CSP) but anything that goes directly through the API is
                // hardened here too.
                .headers(headers -> headers
                        // The browser must never render an API JSON response as HTML.
                        .frameOptions(frame -> frame.deny())
                        // Spring's default already adds X-Content-Type-Options: nosniff.
                        .contentTypeOptions(Customizer.withDefaults())
                        // No referrer leaks across origins.
                        .referrerPolicy(rp -> rp.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        // HSTS: only meaningful when reaching the backend over TLS,
                        // which in production happens through nginx. The header is
                        // harmless (and best-practice) even on plaintext: browsers
                        // ignore it on HTTP responses.
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000)) // 1 year
                        // Minimal CSP for JSON / file downloads. Frontend HTML is
                        // served by nginx and gets its own (stricter) CSP there.
                        .contentSecurityPolicy(csp -> csp
                                .policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh-token",
                                // Logout authenticates with the refresh token in the
                                // body (same model as refresh). Requiring an access
                                // token in addition makes the SPA fail when the
                                // access JWT has already expired but the refresh is
                                // still revocable.
                                "/api/v1/auth/logout",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                // PR-5: Spring Boot Actuator health probes — public so
                                // K8s liveness/readiness checks don't need a JWT.
                                "/actuator/health",
                                "/actuator/health/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                // PR-5: rate limit BEFORE JWT auth so brute-forcers get 429s
                // without burning through bcrypt comparisons.
                .addFilterBefore(authRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
