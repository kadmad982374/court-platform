package sy.gov.sla.identity.api;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Mini-Phase B — PATCH user. Only these three fields are mutable through
 * the admin endpoint. A {@code null} value means "leave unchanged".
 */
public record UpdateUserRequest(
        @Size(max = 160) String fullName,
        @Pattern(regexp = "^09\\d{8}$",
                message = "mobileNumber must be a Syrian mobile in format 09XXXXXXXX")
        String mobileNumber,
        Boolean active
) {}

