-- V15: reminders (Phase 6)
--
-- تذكيرات شخصية مرتبطة بالدعوى (D-037).
-- المالك الحصري = منشئ التذكير (owner_user_id).

CREATE TABLE reminders (
    id                  BIGSERIAL PRIMARY KEY,
    litigation_case_id  BIGINT       NOT NULL REFERENCES litigation_cases(id),
    case_stage_id       BIGINT          REFERENCES case_stages(id),
    owner_user_id       BIGINT       NOT NULL REFERENCES users(id),
    reminder_at         TIMESTAMPTZ  NOT NULL,
    reminder_text       VARCHAR(500) NOT NULL,
    status              VARCHAR(16)  NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_rem_status CHECK (status IN ('PENDING','DONE','CANCELLED'))
);

CREATE INDEX ix_rem_owner       ON reminders(owner_user_id, status);
CREATE INDEX ix_rem_case        ON reminders(litigation_case_id);
CREATE INDEX ix_rem_due         ON reminders(reminder_at, status);

