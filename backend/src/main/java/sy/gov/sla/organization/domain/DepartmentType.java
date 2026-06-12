package sy.gov.sla.organization.domain;

/**
 * أنواع الأقسام داخل الفرع.
 * مرجع: الوثيقة الوظيفية §3.3.
 *
 * الأنواع الأربعة الأولى ثابتة في كل فرع. الأنواع الثلاثة الأخيرة
 * (النقض، القضاء الإداري، المنازعات الخارجية) أُضيفت بطلب العميل وتُزرع
 * لفرع دمشق فقط (المهاجرات V36/V39).
 */
public enum DepartmentType {
    CONCILIATION,
    FIRST_INSTANCE,
    APPEAL,
    EXECUTION,
    // ---- Damascus-only registers (client feedback) ----
    CASSATION,
    ADMINISTRATIVE_JUDICIARY,
    EXTERNAL_DISPUTES
}

