package sy.gov.sla.litigationregistration.domain;

/**
 * حالة دورة حياة الملف الأصلي. مرجع: التقنية §7.1.
 * في المرحلة 2: NEW عند الإنشاء، ACTIVE بعد الإسناد.
 * IN_APPEAL / IN_EXECUTION / CLOSED ستُستخدم في المراحل 4 و5.
 */
public enum LifecycleStatus {
    NEW,
    ACTIVE,
    IN_APPEAL,
    IN_EXECUTION,
    CLOSED
}

