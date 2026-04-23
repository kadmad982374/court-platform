package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank String mobileNumber,
        @NotBlank String code,
        @NotBlank @Size(min = 8, max = 100) String newPassword
) {}

