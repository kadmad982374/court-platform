-- ============================================================
-- V37: Client feedback — allow the flat SINGLE_INSTANCE stage type.
--
-- The new Damascus registers (النقض، القضاء الإداري، المنازعات الخارجية)
-- have no conciliation→first-instance→appeal ladder, so their single stage
-- is recorded as SINGLE_INSTANCE. The existing promotion logic only matches
-- CONCILIATION/FIRST_INSTANCE/APPEAL, so SINGLE_INSTANCE is inert there.
-- ============================================================

ALTER TABLE case_stages DROP CONSTRAINT chk_cs_type;
ALTER TABLE case_stages ADD CONSTRAINT chk_cs_type
    CHECK (stage_type IN ('CONCILIATION','FIRST_INSTANCE','APPEAL','SINGLE_INSTANCE'));
