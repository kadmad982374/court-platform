-- V13: execution module (Phase 5)
--
-- Adds two new tables:
--  * execution_files  — independent execution record per litigation case (D-028).
--  * execution_steps  — append-only timestamped actions per execution file (D-031).
--
-- Notes:
--  * No new CHECK on lifecycle_status ('IN_EXECUTION' already in V6).
--  * No new CHECK on case_stages.stage_status ('PROMOTED_TO_EXECUTION' already in V7).
--  * No new CHECK on user_delegated_permissions.permission_code (V3 left it as plain VARCHAR).

CREATE TABLE execution_files (
    id                       BIGSERIAL PRIMARY KEY,
    litigation_case_id       BIGINT       NOT NULL REFERENCES litigation_cases(id),
    source_stage_id          BIGINT       NOT NULL REFERENCES case_stages(id),
    enforcing_entity_name    VARCHAR(200) NOT NULL,
    executed_against_name    VARCHAR(200) NOT NULL,
    execution_file_type      VARCHAR(64)  NOT NULL,
    execution_file_number    VARCHAR(64)  NOT NULL,
    execution_year           INT          NOT NULL,
    branch_id                BIGINT       NOT NULL REFERENCES branches(id),
    department_id            BIGINT       NOT NULL REFERENCES departments(id),
    assigned_user_id         BIGINT          REFERENCES users(id),
    status                   VARCHAR(32)  NOT NULL,
    created_by_user_id       BIGINT       NOT NULL REFERENCES users(id),
    created_at               TIMESTAMPTZ  NOT NULL,
    updated_at               TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_ef_status CHECK (status IN ('OPEN','IN_PROGRESS','CLOSED','ARCHIVED')),
    CONSTRAINT uq_ef_number_year_branch UNIQUE (branch_id, execution_year, execution_file_number)
);

CREATE INDEX ix_ef_case        ON execution_files(litigation_case_id);
CREATE INDEX ix_ef_branch_dept ON execution_files(branch_id, department_id);
CREATE INDEX ix_ef_assigned    ON execution_files(assigned_user_id);
CREATE INDEX ix_ef_status      ON execution_files(status);
CREATE INDEX ix_ef_source_stage ON execution_files(source_stage_id);

CREATE TABLE execution_steps (
    id                  BIGSERIAL  PRIMARY KEY,
    execution_file_id   BIGINT       NOT NULL REFERENCES execution_files(id),
    step_date           DATE         NOT NULL,
    step_type           VARCHAR(32)  NOT NULL,
    step_description    VARCHAR(2000) NOT NULL,
    created_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_es_type CHECK (step_type IN
        ('NOTICE_REQUEST','NOTICE_ISSUED','SEIZURE_REQUEST','SEIZURE_PLACED',
         'PAYMENT_RECORDED','ADMIN_ACTION','CLOSURE','OTHER'))
);

CREATE INDEX ix_es_file_date ON execution_steps(execution_file_id, step_date, id);
CREATE INDEX ix_es_creator   ON execution_steps(created_by_user_id);

