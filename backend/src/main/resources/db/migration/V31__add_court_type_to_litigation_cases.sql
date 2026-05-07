-- V31: Customer feedback round-2 — court type field on litigation_cases.
--
-- The customer asked for a new field "نوع المحكمة" on the create-case form
-- with values: مستعجل / بحري / مصرفي / عمالي / عادي / تأمين / جمركي / إدارية.
--
-- Strategy:
--   1) Add the column nullable so existing rows survive the migration.
--   2) Backfill all existing cases to 'GENERAL' (عادي) — the safest default.
--   3) Tighten the column to NOT NULL.
--   4) Add a CHECK constraint enumerating the allowed values.

ALTER TABLE litigation_cases
    ADD COLUMN court_type VARCHAR(32);

UPDATE litigation_cases SET court_type = 'GENERAL' WHERE court_type IS NULL;

ALTER TABLE litigation_cases
    ALTER COLUMN court_type SET NOT NULL;

ALTER TABLE litigation_cases
    ADD CONSTRAINT chk_lc_court_type CHECK (court_type IN
        ('URGENT','MARITIME','BANKING','LABOR','GENERAL','INSURANCE','CUSTOMS','ADMINISTRATIVE'));

CREATE INDEX ix_lc_court_type ON litigation_cases(court_type);
