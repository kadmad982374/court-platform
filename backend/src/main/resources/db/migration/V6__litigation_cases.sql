-- V6: litigation_cases (Phase 2)

CREATE TABLE litigation_cases (
    id                          BIGSERIAL PRIMARY KEY,
    public_entity_name          VARCHAR(200) NOT NULL,
    public_entity_position      VARCHAR(16)  NOT NULL,
    opponent_name               VARCHAR(200) NOT NULL,
    original_basis_number       VARCHAR(64)  NOT NULL,
    basis_year                  INT          NOT NULL,
    original_registration_date  DATE         NOT NULL,
    created_branch_id           BIGINT       NOT NULL REFERENCES branches(id),
    created_department_id       BIGINT       NOT NULL REFERENCES departments(id),
    created_court_id            BIGINT       NOT NULL REFERENCES courts(id),
    chamber_name                VARCHAR(128),
    current_stage_id            BIGINT,         -- forward ref, no FK
    current_owner_user_id       BIGINT          REFERENCES users(id),
    lifecycle_status            VARCHAR(32)  NOT NULL,
    created_by_user_id          BIGINT       NOT NULL REFERENCES users(id),
    created_at                  TIMESTAMPTZ  NOT NULL,
    updated_at                  TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_lc_position  CHECK (public_entity_position IN ('PLAINTIFF','DEFENDANT')),
    CONSTRAINT chk_lc_lifecycle CHECK (lifecycle_status IN
        ('NEW','ACTIVE','IN_APPEAL','IN_EXECUTION','CLOSED'))
);

CREATE INDEX ix_lc_branch        ON litigation_cases(created_branch_id);
CREATE INDEX ix_lc_branch_dept   ON litigation_cases(created_branch_id, created_department_id);
CREATE INDEX ix_lc_owner         ON litigation_cases(current_owner_user_id);
CREATE INDEX ix_lc_lifecycle     ON litigation_cases(lifecycle_status);

