package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Mini-Phase B — Create user (D-047).
 *
 * <p>Initial password is admin-supplied. The server BCrypts and stores it.
 * Hand-off (in person, organizational SMS, etc.) is the admin's
 * responsibility. Per D-047, Mini-Phase B does <em>not</em> enforce
 * "must change on first login"; the user can change it later via the
 * existing forgot/reset flow (D-013). A future decision (D-049+) may add
 * a {@code must_change_password} flag and a dedicated change endpoint.</p>
 */
public record CreateUserRequest(
        @NotBlank @Size(min = 3, max = 64) String username,
        @NotBlank @Size(max = 160) String fullName,
        @NotBlank @Pattern(regexp = "^09\\d{8}$",
                message = "mobileNumber must be a Syrian mobile in format 09XXXXXXXX")
        String mobileNumber,
        @NotBlank @Size(min = 8, max = 72) String initialPassword,
        Long defaultBranchId,
        Long defaultDepartmentId,
        Boolean active
) {}

