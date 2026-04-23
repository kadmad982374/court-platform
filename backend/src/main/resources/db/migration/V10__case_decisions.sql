-- V10: case_decisions (Phase 3)
-- One decision per case stage. مرجع: التقنية §5.3 + الوظيفية §7.

CREATE TABLE case_decisions (
    id                  BIGSERIAL PRIMARY KEY,
    case_stage_id       BIGINT       NOT NULL UNIQUE REFERENCES case_stages(id),
    decision_number     VARCHAR(64)  NOT NULL,
    decision_date       DATE         NOT NULL,
    decision_type       VARCHAR(32)  NOT NULL,
    adjudged_amount     NUMERIC(18,2),
    currency_code       VARCHAR(3),
    summary_notes       TEXT,
    finalized_by_user_id BIGINT      NOT NULL REFERENCES users(id),
    finalized_at        TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_decision_type CHECK (decision_type IN
        ('FOR_ENTITY','AGAINST_ENTITY','SETTLEMENT','NON_FINAL'))
);

CREATE INDEX ix_decisions_type ON case_decisions(decision_type);
CREATE INDEX ix_decisions_date ON case_decisions(decision_date);

