package sy.gov.sla.litigationregistration.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import sy.gov.sla.litigationregistration.domain.PublicEntityPosition;

import java.time.LocalDate;

/**
 * تحديث "البيانات الأساسية" فقط — مرجع: الوظيفية §4.7.
 * الحقول كلها اختيارية؛ يتم تحديث المُمرَّر منها فقط.
 *
 * ممنوع هنا: original_registration_date، ownership، stage status.
 */
public record UpdateBasicDataRequest(
        @Size(max = 200) String publicEntityName,
        PublicEntityPosition publicEntityPosition,
        @Size(max = 200) String opponentName,
        @Size(max = 64)  String originalBasisNumber,
        @Min(1900) @Max(2100) Integer basisYear,
        Long courtId,
        @Size(max = 128) String chamberName,
        @Size(max = 64)  String stageBasisNumber,
        @Min(1900) @Max(2100) Integer stageYear,
        LocalDate firstHearingDate,
        @Size(max = 200) String firstPostponementReason
) {}

