package sy.gov.sla.resolvedregister.api;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * صف سجل الفصل. مشتق منطقيًا من JOIN على
 * litigation_cases + case_stages + case_decisions. مرجع: D-025.
 */
public record ResolvedRegisterEntryDto(
        Long caseId,
        Long stageId,
        Long decisionId,
        String publicEntityName,
        String publicEntityPosition,
        String opponentName,
        Long branchId,
        String branchName,
        Long departmentId,
        String departmentType,
        Long courtId,
        String courtName,
        String stageBasisNumber,
        Integer stageYear,
        String decisionNumber,
        LocalDate decisionDate,
        String decisionType,
        BigDecimal adjudgedAmount,
        String currencyCode,
        String summaryNotes,
        String lifecycleStatus,
        String stageStatus
) {}

