package sy.gov.sla.reminders.domain;

/**
 * حالة التذكير. Phase 6 (D-037).
 *
 * أبسط دورة حياة:
 *  PENDING (افتراضي عند الإنشاء)
 *      → DONE (عند إنجاز التذكير)
 *      → CANCELLED (عند إلغاء التذكير)
 *
 * لا توجد transitions أخرى مدعومة (لا re-open في Phase 6).
 */
public enum ReminderStatus {
    PENDING,
    DONE,
    CANCELLED
}

