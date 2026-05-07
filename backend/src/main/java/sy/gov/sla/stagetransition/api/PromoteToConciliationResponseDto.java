package sy.gov.sla.stagetransition.api;

/**
 * Customer feedback round-2: response from "نقل الملف إلى الصلح".
 * Mirrors {@link PromoteToAppealResponseDto} — same shape, only the field
 * name on the new-stage id is conciliation-specific so the frontend can
 * tell the two transitions apart cleanly.
 */
public record PromoteToConciliationResponseDto(
        Long caseId,
        Long previousStageId,
        Long newConciliationStageId,
        String lifecycleStatus
) {}
