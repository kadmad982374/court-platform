package sy.gov.sla.pendingsubmission.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePendingSubmissionRequest(
        @NotNull Long branchId,
        @NotNull Long departmentId,
        @NotBlank @Size(max = 64)  String incomingNumber,
        @Size(max = 64)  String letterNumber,
        @NotBlank @Size(max = 200) String publicEntityName,
        @Size(max = 200) String opponentName,
        @Size(max = 500) String subject,
        @Size(max = 1000) String notes
) {}
