-- V1: Organization tables (Phase 1)

CREATE TABLE branches (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(32)  NOT NULL,
    name_ar         VARCHAR(128) NOT NULL,
    province_name   VARCHAR(128) NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_branches_code UNIQUE (code)
);

CREATE TABLE departments (
    id          BIGSERIAL PRIMARY KEY,
    branch_id   BIGINT       NOT NULL REFERENCES branches(id),
    type        VARCHAR(32)  NOT NULL,
    name_ar     VARCHAR(128) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_departments_branch_type UNIQUE (branch_id, type),
    CONSTRAINT chk_departments_type CHECK (type IN ('CONCILIATION','FIRST_INSTANCE','APPEAL','EXECUTION'))
);

CREATE INDEX ix_departments_branch ON departments(branch_id);

CREATE TABLE courts (
    id                BIGSERIAL PRIMARY KEY,
    branch_id         BIGINT       NOT NULL REFERENCES branches(id),
    department_type   VARCHAR(32)  NOT NULL,
    name_ar           VARCHAR(160) NOT NULL,
    chamber_support   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_courts_dept_type CHECK (department_type IN ('CONCILIATION','FIRST_INSTANCE','APPEAL','EXECUTION'))
);

CREATE INDEX ix_courts_branch ON courts(branch_id);
CREATE INDEX ix_courts_branch_dept ON courts(branch_id, department_type);

