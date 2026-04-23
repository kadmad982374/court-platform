package sy.gov.sla.stagetransition.application;

import java.time.Instant;

/**
 * يُنشر بعد commit عند ترقية مرحلة دعوى إلى الاستئناف.
 * المستهلكون (notifications/audit) سيُربطون في المراحل اللاحقة.
 */
public record CasePromotedToAppealEvent(
        Long caseId,
        Long previousStageId,
        Long newAppealStageId,
        Long actorUserId,
        Instant occurredAt
) {}

