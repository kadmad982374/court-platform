package sy.gov.sla.litigationprogression.api;

import sy.gov.sla.litigationregistration.domain.StageStatus;

import java.time.LocalDate;

/**
 * Projection بسيط للواجهة. مرجع: الوظيفية §6.5.
 * - previous_* قد تكون null للـ stage التي ليس لها سوى INITIAL.
 * - current_* تعكس آخر entry غير FINALIZED (أو INITIAL إن لم يحصل rollover).
 */
public record StageProgressionDto(
        Long stageId,
        Long caseId,
        StageStatus latestStageStatus,
        LocalDate previousHearingDate,
        String previousPostponementReasonCode,
        String previousPostponementReasonLabel,
        LocalDate currentHearingDate,
        String currentPostponementReasonCode,
        String currentPostponementReasonLabel
) {}

