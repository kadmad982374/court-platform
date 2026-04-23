package sy.gov.sla.litigationregistration.domain;

/**
 * نوع المرحلة القضائية. مرجع: الوظيفية §3.3 + التقنية §5.3.
 * في المرحلة 2 يُسمح بالأنواع الثلاثة (CONCILIATION, FIRST_INSTANCE, APPEAL)
 * لكن منطق الترقية للاستئناف لا يُنفَّذ بعد (المرحلة 4).
 */
public enum StageType {
    CONCILIATION,
    FIRST_INSTANCE,
    APPEAL
}

