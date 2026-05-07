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
    /** Customer feedback round-2: source stage of a "نقل الملف إلى الصلح" transfer.
     *  Mirrors PROMOTED_TO_APPEAL but for transfers to a Conciliation stage. */
    PROMOTED_TO_CONCILIATION,
    ARCHIVED
}

