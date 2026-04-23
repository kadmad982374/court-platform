package sy.gov.sla.execution.application;

import java.time.Instant;

/**
 * يُنشر بعد commit ناجح لترقية دعوى إلى ملف تنفيذي. مرجع: D-028.
 * المستهلكون (notifications/audit) يأتون في مراحل لاحقة.
 */
public record CasePromotedToExecutionEvent(
        Long caseId,
        Long sourceStageId,
        Long executionFileId,
        Long actorUserId,
        Instant occurredAt
) {}

