-- V29: Customer feedback round-2 — promote-to-conciliation.
--
-- The customer asked for a new "نقل الملف إلى الصلح" action mirroring the
-- existing promote-to-appeal flow. Source stage gets read-only +
-- stage_status='PROMOTED_TO_CONCILIATION'; a new CONCILIATION stage is
-- created. The CHECK constraint on case_stages.stage_status currently
-- doesn't allow that value — extend it.

ALTER TABLE case_stages
    DROP CONSTRAINT chk_cs_status;

ALTER TABLE case_stages
    ADD CONSTRAINT chk_cs_status CHECK (stage_status IN
        ('REGISTERED','ASSIGNED','IN_PROGRESS','FINALIZED',
         'PROMOTED_TO_APPEAL','PROMOTED_TO_EXECUTION','PROMOTED_TO_CONCILIATION',
         'ARCHIVED'));
