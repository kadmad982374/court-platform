package sy.gov.sla.litigationregistration.application;

import java.time.Instant;

/**
 * يُنشر بعد commit عند إنشاء دعوى جديدة.
 * المستهلكون (notifications/audit) سيُربطون في المراحل اللاحقة.
 */
public record CaseRegisteredEvent(
        Long caseId,
        Long stageId,
        Long branchId,
        Long departmentId,
        Long courtId,
        Long createdByUserId,
        Long initialOwnerUserId,
        Instant occurredAt
) {}

