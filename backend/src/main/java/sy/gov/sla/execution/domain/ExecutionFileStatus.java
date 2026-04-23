package sy.gov.sla.execution.domain;

/**
 * حالة الملف التنفيذي. مرجع: D-028 (Phase 5).
 *
 * Phase 5 لا يكشف endpoint لتعديل الحالة؛ تبدأ كل ملفات التنفيذ بـ OPEN
 * وتُعدَّل لاحقًا (Phase 6+) عبر قرار جديد إذا لزم.
 */
public enum ExecutionFileStatus {
    OPEN,
    IN_PROGRESS,
    CLOSED,
    ARCHIVED
}

