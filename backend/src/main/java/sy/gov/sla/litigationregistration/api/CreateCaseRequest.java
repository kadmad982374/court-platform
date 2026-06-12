package sy.gov.sla.litigationregistration.api;

import jakarta.validation.constraints.*;
import sy.gov.sla.litigationregistration.domain.CourtType;
import sy.gov.sla.litigationregistration.domain.PublicEntityPosition;
import sy.gov.sla.litigationregistration.domain.StageType;

import java.time.LocalDate;

// Customer feedback round-2 (PR-15a):
//   basisYear / stageYear changed from primitive `int` to boxed `Integer`.
//   Why: a missing or NaN year on the wire used to fail Jackson coercion and
//   surface as INVALID_REQUEST_BODY ("بنية الطلب غير صحيحة"). With Integer +
//   @NotNull the same payload now produces a clean field-level VALIDATION_ERROR
//   (matching UpdateBasicDataRequest / CorrectFinalizedCaseRequest, which already
//   use boxed Integer). The frontend now derives both years from the registration
//   date, so a missing year should never reach the wire.
public record CreateCaseRequest(
        @NotBlank @Size(max = 200) String publicEntityName,
        @NotNull PublicEntityPosition publicEntityPosition,
        @NotBlank @Size(max = 200) String opponentName,
        @NotBlank @Size(max = 64) String originalBasisNumber,
        @NotNull @Min(1900) @Max(2100) Integer basisYear,
        @NotNull LocalDate originalRegistrationDate,
        @NotNull Long branchId,
        @NotNull Long departmentId,
        @NotNull Long courtId,
        @Size(max = 128) String chamberName,
        /** Customer feedback round-2: required "نوع المحكمة". */
        @NotNull CourtType courtType,
        @NotNull StageType stageType,
        @NotBlank @Size(max = 64) String stageBasisNumber,
        @NotNull @Min(1900) @Max(2100) Integer stageYear,
        @NotNull LocalDate firstHearingDate,
        @NotBlank @Size(max = 200) String firstPostponementReason,
        // Client feedback — optional cassation / external-disputes extras.
        // Only populated for the Damascus النقض / المنازعات الخارجية registers.
        @Size(max = 64)  String circulationNumber,
        @Size(max = 64)  String capacity,
        @Size(max = 200) String appealResult
) {}

