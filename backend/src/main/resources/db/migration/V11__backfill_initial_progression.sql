-- V11: Backfill INITIAL hearing_progression_entries from case_stages transitional fields (D-020/D-022)
-- Creates one INITIAL entry per existing case_stage based on
--   first_hearing_date     -> hearing_date
--   first_postponement_reason -> postponement_reason_label (verbatim free text)
-- postponement_reason_code stays NULL (legacy free text was unmanaged).
-- The legacy columns remain in case_stages as archive but are no longer used by new APIs.

INSERT INTO hearing_progression_entries
    (case_stage_id, hearing_date, postponement_reason_code,
     postponement_reason_label, entered_by_user_id, entry_type, created_at)
SELECT
    cs.id,
    cs.first_hearing_date,
    NULL,
    cs.first_postponement_reason,
    lc.created_by_user_id,
    'INITIAL',
    cs.started_at
FROM case_stages cs
JOIN litigation_cases lc ON lc.id = cs.litigation_case_id
WHERE NOT EXISTS (
    SELECT 1 FROM hearing_progression_entries h
    WHERE h.case_stage_id = cs.id AND h.entry_type = 'INITIAL'
);

