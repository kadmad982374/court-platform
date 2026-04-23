-- V14: attachments (Phase 6)
--
-- Single unified attachments table for CASE_STAGE / EXECUTION_FILE / EXECUTION_STEP scopes (D-036).
-- لا حذف ولا تعديل: upload + download فقط في Phase 6.

CREATE TABLE attachments (
    id                       BIGSERIAL PRIMARY KEY,
    attachment_scope_type    VARCHAR(32)  NOT NULL,
    scope_id                 BIGINT       NOT NULL,
    original_filename        VARCHAR(255) NOT NULL,
    content_type             VARCHAR(128) NOT NULL,
    file_size_bytes          BIGINT       NOT NULL,
    storage_key              VARCHAR(512) NOT NULL,
    uploaded_by_user_id      BIGINT       NOT NULL REFERENCES users(id),
    uploaded_at              TIMESTAMPTZ  NOT NULL,
    checksum_sha256          VARCHAR(64),
    is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_att_scope_type CHECK (attachment_scope_type IN
        ('CASE_STAGE','EXECUTION_FILE','EXECUTION_STEP')),
    CONSTRAINT chk_att_size_positive CHECK (file_size_bytes >= 0),
    CONSTRAINT uq_att_storage_key UNIQUE (storage_key)
);

CREATE INDEX ix_att_scope          ON attachments(attachment_scope_type, scope_id);
CREATE INDEX ix_att_uploaded_by    ON attachments(uploaded_by_user_id);
CREATE INDEX ix_att_uploaded_at    ON attachments(uploaded_at);

