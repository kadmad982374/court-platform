-- V33: optional free-text note attached to a hearing entry (rollover / finalize).
-- Shown in the "مجريات الجلسة" (stage activity) panel on the stage detail page.

ALTER TABLE hearing_progression_entries
    ADD COLUMN notes VARCHAR(2000);
