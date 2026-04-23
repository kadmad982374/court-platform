package sy.gov.sla.attachments.domain;

/**
 * نطاق المرفق. Phase 6 (D-036).
 *
 * يحدد نوع الكيان المضيف للمرفق:
 *  - CASE_STAGE     → scope_id = case_stages.id
 *  - EXECUTION_FILE → scope_id = execution_files.id
 *  - EXECUTION_STEP → scope_id = execution_steps.id
 *
 * لا توسعة لـ LITIGATION_CASE في Phase 6 — التعليم يُربط بمرحلة محددة دائمًا.
 */
public enum AttachmentScopeType {
    CASE_STAGE,
    EXECUTION_FILE,
    EXECUTION_STEP
}

