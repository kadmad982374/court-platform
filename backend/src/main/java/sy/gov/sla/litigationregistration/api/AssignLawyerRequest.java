package sy.gov.sla.litigationregistration.api;

import jakarta.validation.constraints.NotNull;

public record AssignLawyerRequest(@NotNull Long lawyerUserId) {}

