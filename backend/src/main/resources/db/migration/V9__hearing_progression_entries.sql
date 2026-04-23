-- V9: hearing_progression_entries (Phase 3) — append-only

CREATE TABLE hearing_progression_entries (
    id                         BIGSERIAL PRIMARY KEY,
    case_stage_id              BIGINT       NOT NULL REFERENCES case_stages(id),
    hearing_date               DATE         NOT NULL,
    -- Code is required for INITIAL/ROLLOVER, NULL for FINALIZED + legacy backfill (D-022).
    postponement_reason_code   VARCHAR(64)  REFERENCES postponement_reasons(code),
    postponement_reason_label  VARCHAR(200) NOT NULL,
    entered_by_user_id         BIGINT       NOT NULL REFERENCES users(id),
    entry_type                 VARCHAR(16)  NOT NULL,
    created_at                 TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_hpe_type CHECK (entry_type IN ('INITIAL','ROLLOVER','FINALIZED'))
);

CREATE INDEX ix_hpe_stage_created ON hearing_progression_entries(case_stage_id, created_at);
CREATE INDEX ix_hpe_entered_by    ON hearing_progression_entries(entered_by_user_id);

