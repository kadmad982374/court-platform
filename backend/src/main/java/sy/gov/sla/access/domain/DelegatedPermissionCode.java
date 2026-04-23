package sy.gov.sla.access.domain;
/**
 * أكواد التفويضات الجزئية للموظف الإداري (ADMIN_CLERK).
 * مرجع: D-004 و D-027 في PROJECT_ASSUMPTIONS_AND_DECISIONS.md.
 *
 * كل تفويض يخزن كسجل في user_delegated_permissions مع granted=true لتفعيله؛
 * غياب السجل أو granted=false يعني عدم منح التفويض.
 *
 * ملاحظة: هذه الأكواد تُستهلك من Application services في وحدات
 * litigation-registration و stage-transition وغيرها.
 */
public enum DelegatedPermissionCode {
    /** إنشاء دعوى جديدة. */
    CREATE_CASE,
    /** تعديل البيانات الأساسية للدعوى. */
    EDIT_CASE_BASIC_DATA,
    /** إسناد محامي للدعوى. */
    ASSIGN_LAWYER,
    /** تصحيح بيانات دعوى مفصولة (محدود). */
    CORRECT_FINALIZED_CASE,
    /** فصل الدعوى مباشرة (للحالات الاستثنائية فقط) — يُستخدم بحذر، D-014. */
    DIRECT_FINALIZE_CASE,
    /** منح/سحب الوصول للمحاكم على مستوى المستخدم. */
    MANAGE_COURT_ACCESS,
    /** ترقية المرحلة الحالية إلى الاستئناف — D-027 (Phase 4). */
    PROMOTE_TO_APPEAL,
    /** ترقية الدعوى إلى ملف تنفيذي مستقل — D-030 (Phase 5). */
    PROMOTE_TO_EXECUTION,
    /** إضافة خطوة تنفيذية إلى ملف تنفيذي قائم — D-030 (Phase 5). */
    ADD_EXECUTION_STEP
}
