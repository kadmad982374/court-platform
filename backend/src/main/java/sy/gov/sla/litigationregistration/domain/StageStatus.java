package sy.gov.sla.litigationregistration.domain;

/**
 * حالة المرحلة القضائية. مرجع: التقنية §7.2.
 * في المرحلة 2 تُستخدم: REGISTERED, ASSIGNED.
 * IN_PROGRESS / FINALIZED / PROMOTED_* / ARCHIVED للمراحل اللاحقة.
 */
public enum StageStatus {
    REGISTERED,
    ASSIGNED,
    IN_PROGRESS,
    FINALIZED,
    PROMOTED_TO_APPEAL,
    PROMOTED_TO_EXECUTION,
    ARCHIVED
}

