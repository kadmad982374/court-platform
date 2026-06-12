package sy.gov.sla.pendingsubmission.api;

import java.time.Instant;

public record PendingSubmissionDto(
        Long id,
        Long branchId,
        Long departmentId,
        String incomingNumber,
        String letterNumber,
        String publicEntityName,
        String opponentName,
        String subject,
        String notes,
        Long createdByUserId,
        Instant createdAt,
        Instant updatedAt
) {}
