package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(@NotBlank String mobileNumber) {}

