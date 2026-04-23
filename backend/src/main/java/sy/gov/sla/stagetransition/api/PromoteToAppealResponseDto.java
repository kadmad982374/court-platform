package sy.gov.sla.stagetransition.api;

public record PromoteToAppealResponseDto(
        Long caseId,
        Long previousStageId,
        Long newAppealStageId,
        String lifecycleStatus
) {}

