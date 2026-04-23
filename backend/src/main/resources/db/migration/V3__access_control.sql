-- V3: Access control tables (Phase 1)

CREATE TABLE roles (
    id       BIGSERIAL PRIMARY KEY,
    type     VARCHAR(32)  NOT NULL,
    name_ar  VARCHAR(128) NOT NULL,
    CONSTRAINT chk_roles_type CHECK (type IN (
        'CENTRAL_SUPERVISOR','BRANCH_HEAD','SECTION_HEAD','ADMIN_CLERK',
        'STATE_LAWYER','READ_ONLY_SUPERVISOR','SPECIAL_INSPECTOR')),
    CONSTRAINT uk_roles_type UNIQUE (type)
);

CREATE TABLE user_roles (
    id       BIGSERIAL PRIMARY KEY,
    user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id  BIGINT NOT NULL REFERENCES roles(id),
    CONSTRAINT uk_user_roles_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE user_department_memberships (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id       BIGINT      NOT NULL REFERENCES branches(id),
    department_id   BIGINT      REFERENCES departments(id),
    membership_type VARCHAR(32) NOT NULL,
    is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_membership_type CHECK (membership_type IN
        ('SECTION_HEAD','ADMIN_CLERK','STATE_LAWYER','BRANCH_HEAD'))
);
CREATE INDEX ix_membership_user   ON user_department_memberships(user_id);
CREATE INDEX ix_membership_branch ON user_department_memberships(branch_id);
CREATE INDEX ix_membership_dept   ON user_department_memberships(department_id);

CREATE TABLE user_court_access (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    court_id            BIGINT       NOT NULL REFERENCES courts(id),
    granted_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    granted_at          TIMESTAMPTZ  NOT NULL,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_user_court_access_user_court UNIQUE (user_id, court_id)
);
CREATE INDEX ix_user_court_access_user ON user_court_access(user_id);

CREATE TABLE user_delegated_permissions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_code     VARCHAR(64)  NOT NULL,
    granted             BOOLEAN      NOT NULL,
    granted_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    granted_at          TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uk_user_delegated_user_code UNIQUE (user_id, permission_code)
);
CREATE INDEX ix_user_delegated_user ON user_delegated_permissions(user_id);


