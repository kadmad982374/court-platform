package sy.gov.sla.execution.domain;

/**
 * نوع الخطوة التنفيذية. مرجع: D-031 (Phase 5).
 *
 * قائمة مغلقة مبدئية مع قيمة OTHER كصمام أمان. يمكن في مرحلة لاحقة
 * تحويلها إلى Reference Table إذا تطلب الواقع التشغيلي ذلك (قرار جديد).
 */
public enum ExecutionStepType {
    NOTICE_REQUEST,
    NOTICE_ISSUED,
    SEIZURE_REQUEST,
    SEIZURE_PLACED,
    PAYMENT_RECORDED,
    ADMIN_ACTION,
    CLOSURE,
    OTHER
}

