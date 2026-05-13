-- V32: Denormalized last_hearing_date on litigation_cases for hearing-date sort + filter.
--
-- Customer feedback: cases must be ordered by hearing date (newest first),
-- and any role can filter by an exact hearing date.
--
-- Sources for "last hearing date" of a case:
--   * MAX(hearing_progression_entries.hearing_date) across all stages of the case
--   * MAX(case_stages.first_hearing_date) — covers stages whose initial date
--     has not yet been mirrored into hearing_progression_entries (D-020 transitional field)
--
-- Maintained at the application layer (see LitigationCaseRepository.bumpLastHearingDate)
-- to avoid optimistic-lock races between Postgres triggers and Hibernate dirty updates.

ALTER TABLE litigation_cases
    ADD COLUMN last_hearing_date DATE NULL;

WITH per_case AS (
    SELECT cs.litigation_case_id AS case_id, MAX(h.hearing_date) AS d
    FROM hearing_progression_entries h
    JOIN case_stages cs ON cs.id = h.case_stage_id
    GROUP BY cs.litigation_case_id

    UNION ALL

    SELECT litigation_case_id AS case_id, MAX(first_hearing_date) AS d
    FROM case_stages
    GROUP BY litigation_case_id
)
UPDATE litigation_cases lc
SET last_hearing_date = sub.d
FROM (
    SELECT case_id, MAX(d) AS d FROM per_case GROUP BY case_id
) sub
WHERE lc.id = sub.case_id;

CREATE INDEX ix_lc_last_hearing_date_desc
    ON litigation_cases (last_hearing_date DESC NULLS LAST);
