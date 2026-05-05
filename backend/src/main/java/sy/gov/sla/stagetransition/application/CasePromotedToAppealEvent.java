package sy.gov.sla.stagetransition.application;

import java.time.Instant;

/**
 * يُنشر بعد commit عند ترقية مرحلة دعوى إلى الاستئناف.
 * <p>
 * PR-8 (customer feedback C-4): يحمل أيضًا (appealBranchId, appealDepartmentId)
 * — قسم الاستئناف الذي وصلت إليه الدعوى — حتى يستطيع المستهلكون (الإشعارات
 * تحديدًا) فان-آوت إلى رئيس قسم الاستئناف ومحضّر القسم بدون استعلامات إضافية.
 */
public record CasePromotedToAppealEvent(
        Long caseId,
        Long previousStageId,
        Long newAppealStageId,
        Long appealBranchId,
        Long appealDepartmentId,
        Long actorUserId,
        Instant occurredAt
) {}

