package sy.gov.sla.identity.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.security.SecurityUtils;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public TokenPairResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @PostMapping("/refresh-token")
    public TokenPairResponse refresh(@Valid @RequestBody RefreshTokenRequest req) {
        return authService.refresh(req);
    }

    @PostMapping("/logout")
    public void logout(@Valid @RequestBody LogoutRequest req) {
        authService.logout(req);
    }

    @PostMapping("/forgot-password")
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        authService.forgotPassword(req);
    }

    @PostMapping("/reset-password")
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        authService.resetPassword(req);
    }

    /**
     * D-049 — Authenticated user changes their own password.
     * Successful change clears mustChangePassword and revokes all active refresh
     * tokens; the caller must sign in again.
     */
    @PostMapping("/change-password")
    public void changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(SecurityUtils.currentUserOrThrow().userId(), req);
    }
}

