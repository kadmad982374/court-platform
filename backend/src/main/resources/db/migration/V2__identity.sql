-- V2: Identity tables (Phase 1)

CREATE TABLE users (
    id                    BIGSERIAL PRIMARY KEY,
    username              VARCHAR(64)  NOT NULL,
    full_name             VARCHAR(160) NOT NULL,
    mobile_number         VARCHAR(32)  NOT NULL,
    password_hash         VARCHAR(100) NOT NULL,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    is_locked             BOOLEAN      NOT NULL DEFAULT FALSE,
    default_branch_id     BIGINT       REFERENCES branches(id),
    default_department_id BIGINT       REFERENCES departments(id),
    created_at            TIMESTAMPTZ  NOT NULL,
    last_login_at         TIMESTAMPTZ,
    CONSTRAINT uk_users_username      UNIQUE (username),
    CONSTRAINT uk_users_mobile_number UNIQUE (mobile_number)
);

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id),
    token_hash  VARCHAR(128) NOT NULL,
    issued_at   TIMESTAMPTZ  NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    revoked_at  TIMESTAMPTZ,
    CONSTRAINT uk_refresh_tokens_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE password_reset_codes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id),
    code_hash   VARCHAR(128) NOT NULL,
    issued_at   TIMESTAMPTZ  NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,
    consumed    BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX ix_password_reset_user ON password_reset_codes(user_id);

