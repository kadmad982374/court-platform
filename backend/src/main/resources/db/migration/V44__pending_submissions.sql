-- ============================================================
-- V44: Client feedback #3 — «تحت الرفع» pre-case intake register.
--
-- A lightweight log of incoming letters awaiting filing, distinct from
-- litigation cases (no lifecycle/stages). Scoped to a (branch, department)
-- like cases so branch-head / admin can read and section-head / admin-clerk
-- can add. Columns mirror the client's table:
--   رقم الوارد · رقم الكتاب · الجهة العامة · الخصم · موضوع الكتاب · ملاحظات
-- ============================================================

CREATE TABLE pending_submissions (
    id                  BIGSERIAL PRIMARY KEY,
    branch_id           BIGINT       NOT NULL REFERENCES branches(id),
    department_id       BIGINT       NOT NULL REFERENCES departments(id),
    incoming_number     VARCHAR(64)  NOT NULL,   -- رقم الوارد
    letter_number       VARCHAR(64),             -- رقم الكتاب
    public_entity_name  VARCHAR(200) NOT NULL,   -- الجهة العامة
    opponent_name       VARCHAR(200),            -- الخصم
    subject             VARCHAR(500),            -- موضوع الكتاب
    notes               VARCHAR(1000),           -- ملاحظات
    created_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ  NOT NULL,
    updated_at          TIMESTAMPTZ  NOT NULL,
    version             BIGINT       NOT NULL DEFAULT 0
);

CREATE INDEX ix_ps_branch_dept ON pending_submissions(branch_id, department_id);
