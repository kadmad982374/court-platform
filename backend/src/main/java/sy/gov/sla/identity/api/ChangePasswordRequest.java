package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * D-049 — payload for {@code POST /api/v1/auth/change-password}.
 *
 * Authenticated endpoint. The user supplies their current password and a new one;
 * server verifies the old hash, encodes the new one, clears mustChangePassword,
 * and revokes every active refresh token. Caller must re-login after success.
 */
public record ChangePasswordRequest(
        @NotBlank String oldPassword,
        @NotBlank @Size(min = 8, max = 100) String newPassword
) {}
