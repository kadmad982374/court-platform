package sy.gov.sla.litigationprogression.api;

/**
 * مرجع أسباب التأجيل (Reference Table) — عرض مبسَّط للواجهة.
 * مرجع: الوظيفية §6.5، D-008، D-022.
 */
public record PostponementReasonDto(
        String code,
        String labelAr,
        boolean active
) {}

