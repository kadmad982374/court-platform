-- V7: case_stages (Phase 2)

CREATE TABLE case_stages (
    id                         BIGSERIAL PRIMARY KEY,
    litigation_case_id         BIGINT       NOT NULL REFERENCES litigation_cases(id),
    stage_type                 VARCHAR(32)  NOT NULL,
    branch_id                  BIGINT       NOT NULL REFERENCES branches(id),
    department_id              BIGINT       NOT NULL REFERENCES departments(id),
    court_id                   BIGINT       NOT NULL REFERENCES courts(id),
    chamber_name               VARCHAR(128),
    stage_basis_number         VARCHAR(64)  NOT NULL,
    stage_year                 INT          NOT NULL,
    assigned_lawyer_user_id    BIGINT          REFERENCES users(id),
    stage_status               VARCHAR(32)  NOT NULL,
    parent_stage_id            BIGINT,        -- forward/self ref, no FK
    is_read_only               BOOLEAN      NOT NULL DEFAULT FALSE,
    first_hearing_date         DATE         NOT NULL,
    first_postponement_reason  VARCHAR(200) NOT NULL,
    started_at                 TIMESTAMPTZ  NOT NULL,
    ended_at                   TIMESTAMPTZ,
    CONSTRAINT chk_cs_type   CHECK (stage_type   IN ('CONCILIATION','FIRST_INSTANCE','APPEAL')),
    CONSTRAINT chk_cs_status CHECK (stage_status IN
        ('REGISTERED','ASSIGNED','IN_PROGRESS','FINALIZED',
         'PROMOTED_TO_APPEAL','PROMOTED_TO_EXECUTION','ARCHIVED'))
);

CREATE INDEX ix_cs_case      ON case_stages(litigation_case_id);
CREATE INDEX ix_cs_lawyer    ON case_stages(assigned_lawyer_user_id);
CREATE INDEX ix_cs_branch    ON case_stages(branch_id);
CREATE INDEX ix_cs_dept      ON case_stages(department_id);

