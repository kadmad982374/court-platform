package sy.gov.sla.litigationregistration.api;

import jakarta.validation.constraints.*;
import sy.gov.sla.litigationregistration.domain.PublicEntityPosition;
import sy.gov.sla.litigationregistration.domain.StageType;

import java.time.LocalDate;

public record CreateCaseRequest(
        @NotBlank @Size(max = 200) String publicEntityName,
        @NotNull PublicEntityPosition publicEntityPosition,
        @NotBlank @Size(max = 200) String opponentName,
        @NotBlank @Size(max = 64) String originalBasisNumber,
        @Min(1900) @Max(2100) int basisYear,
        @NotNull LocalDate originalRegistrationDate,
        @NotNull Long branchId,
        @NotNull Long departmentId,
        @NotNull Long courtId,
        @Size(max = 128) String chamberName,
        @NotNull StageType stageType,
        @NotBlank @Size(max = 64) String stageBasisNumber,
        @Min(1900) @Max(2100) int stageYear,
        @NotNull LocalDate firstHearingDate,
        @NotBlank @Size(max = 200) String firstPostponementReason
) {}

