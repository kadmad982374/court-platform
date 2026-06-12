-- ============================================================
-- V38: Client feedback — cassation / external-disputes extra fields.
--
-- All nullable, no backfill, no CHECK: meaningful only for the new
-- Damascus registers; existing cases and all other branches stay NULL.
--   circulation_number  رقم المتداول     (النقض + المنازعات الخارجية)
--   capacity            صفتها            (طاعن / مطعون ضده ...)
--   appeal_result       نتيجة الطعن      (النقض)
-- ============================================================

ALTER TABLE litigation_cases
    ADD COLUMN IF NOT EXISTS circulation_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS capacity           VARCHAR(64),
    ADD COLUMN IF NOT EXISTS appeal_result      VARCHAR(200);
