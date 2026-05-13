package sy.gov.sla.litigationregistration.api;

import sy.gov.sla.litigationregistration.domain.CourtType;
import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.PublicEntityPosition;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record LitigationCaseDto(
        Long id,
        String publicEntityName,
        PublicEntityPosition publicEntityPosition,
        String opponentName,
        String originalBasisNumber,
        int basisYear,
        LocalDate originalRegistrationDate,
        Long createdBranchId,
        Long createdDepartmentId,
        Long createdCourtId,
        String chamberName,
        CourtType courtType,
        Long currentStageId,
        Long currentOwnerUserId,
        LifecycleStatus lifecycleStatus,
        Long createdByUserId,
        Instant createdAt,
        Instant updatedAt,
        LocalDate lastHearingDate,
        List<CaseStageDto> stages
) {}

