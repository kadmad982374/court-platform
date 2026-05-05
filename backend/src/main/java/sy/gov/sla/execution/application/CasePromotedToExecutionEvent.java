package sy.gov.sla.execution.application;

import java.time.Instant;

/**
 * يُنشر بعد commit ناجح لترقية دعوى إلى ملف تنفيذي. مرجع: D-028.
 * <p>
 * PR-8 (customer feedback C-4): يحمل أيضًا (executionBranchId,
 * executionDepartmentId) — قسم التنفيذ الذي يستضيف الملف الجديد — حتى يستطيع
 * المستهلكون فان-آوت لرئيس القسم ومحضّره بدون استعلامات إضافية.
 */
public record CasePromotedToExecutionEvent(
        Long caseId,
        Long sourceStageId,
        Long executionFileId,
        Long executionBranchId,
        Long executionDepartmentId,
        Long actorUserId,
        Instant occurredAt
) {}

