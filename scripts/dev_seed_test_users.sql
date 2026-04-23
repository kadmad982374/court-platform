-- ============================================================
-- Test users seed — Phase 11 manual testing only.
-- ============================================================
-- This script creates 4 test users in branch DAMASCUS,
-- department FIRST_INSTANCE, all sharing admin's password
-- (ChangeMe!2026) by copying the password_hash. So you must
-- run this AFTER the backend has booted at least once (so the
-- BootstrapAdminRunner created the 'admin' user — D-018).
--
-- Run with:
--   psql -U <user> -d <dbname> -f scripts/dev_seed_test_users.sql
-- Or paste into your SQL client (DBeaver / pgAdmin / IntelliJ DB).
--
-- Re-running: idempotent — it skips users that already exist by username.
-- ============================================================

DO $$
DECLARE
    v_branch_id        BIGINT;
    v_dept_fi_id       BIGINT;     -- FIRST_INSTANCE department
    v_dept_concil_id   BIGINT;     -- CONCILIATION department
    v_admin_hash       VARCHAR(100);
    v_role_branch_head BIGINT;
    v_role_section_head BIGINT;
    v_role_admin_clerk BIGINT;
    v_role_state_lawyer BIGINT;
    v_role_read_only   BIGINT;

    v_user_branch_head BIGINT;
    v_user_section_head BIGINT;
    v_user_admin_clerk BIGINT;
    v_user_state_lawyer BIGINT;
    v_user_read_only   BIGINT;
BEGIN
    -- 1) Look up the seed branch + departments.
    SELECT id INTO v_branch_id      FROM branches    WHERE code = 'DAMASCUS';
    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'Branch DAMASCUS not found — did Flyway V4 run?';
    END IF;

    SELECT id INTO v_dept_fi_id     FROM departments WHERE branch_id = v_branch_id AND type = 'FIRST_INSTANCE';
    SELECT id INTO v_dept_concil_id FROM departments WHERE branch_id = v_branch_id AND type = 'CONCILIATION';

    -- 2) Copy admin's BCrypt password_hash so test users use 'ChangeMe!2026'.
    SELECT password_hash INTO v_admin_hash FROM users WHERE username = 'admin';
    IF v_admin_hash IS NULL THEN
        RAISE EXCEPTION 'Admin user not found. Start the backend once first (BootstrapAdminRunner — D-018).';
    END IF;

    -- 3) Look up role IDs.
    SELECT id INTO v_role_branch_head   FROM roles WHERE type = 'BRANCH_HEAD';
    SELECT id INTO v_role_section_head  FROM roles WHERE type = 'SECTION_HEAD';
    SELECT id INTO v_role_admin_clerk   FROM roles WHERE type = 'ADMIN_CLERK';
    SELECT id INTO v_role_state_lawyer  FROM roles WHERE type = 'STATE_LAWYER';
    SELECT id INTO v_role_read_only     FROM roles WHERE type = 'READ_ONLY_SUPERVISOR';

    -- ============================================================
    -- 4) Create test users (idempotent — skip if username exists).
    -- ============================================================

    -- 4a) BRANCH_HEAD
    SELECT id INTO v_user_branch_head FROM users WHERE username = 'head_dam';
    IF v_user_branch_head IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('head_dam', 'رئيس فرع دمشق (تجريبي)', '0000000001', v_admin_hash,
                TRUE, FALSE, v_branch_id, NULL, now())
        RETURNING id INTO v_user_branch_head;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_user_branch_head, v_role_branch_head);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_user_branch_head, v_branch_id, NULL, 'BRANCH_HEAD', TRUE, TRUE);
    END IF;

    -- 4b) SECTION_HEAD of FIRST_INSTANCE / DAMASCUS
    SELECT id INTO v_user_section_head FROM users WHERE username = 'section_fi_dam';
    IF v_user_section_head IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('section_fi_dam', 'رئيس قسم البداية - دمشق (تجريبي)', '0000000002', v_admin_hash,
                TRUE, FALSE, v_branch_id, v_dept_fi_id, now())
        RETURNING id INTO v_user_section_head;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_user_section_head, v_role_section_head);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_user_section_head, v_branch_id, v_dept_fi_id, 'SECTION_HEAD', TRUE, TRUE);
    END IF;

    -- 4c) ADMIN_CLERK with ALL delegated permissions (D-004) on FIRST_INSTANCE / DAMASCUS
    SELECT id INTO v_user_admin_clerk FROM users WHERE username = 'clerk_fi_dam';
    IF v_user_admin_clerk IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('clerk_fi_dam', 'موظف إداري - بداية دمشق (تجريبي)', '0000000003', v_admin_hash,
                TRUE, FALSE, v_branch_id, v_dept_fi_id, now())
        RETURNING id INTO v_user_admin_clerk;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_user_admin_clerk, v_role_admin_clerk);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_user_admin_clerk, v_branch_id, v_dept_fi_id, 'ADMIN_CLERK', TRUE, TRUE);

        -- Delegated permissions (D-004): granted=TRUE for the full set.
        INSERT INTO user_delegated_permissions (user_id, permission_code, granted, granted_by_user_id, granted_at)
        SELECT v_user_admin_clerk, code, TRUE, v_user_section_head, now()
        FROM (VALUES
            ('CREATE_CASE'),
            ('EDIT_CASE_BASIC_DATA'),
            ('ASSIGN_LAWYER'),
            ('PROMOTE_TO_APPEAL'),
            ('PROMOTE_TO_EXECUTION'),
            ('ADD_EXECUTION_STEP'),
            ('CORRECT_FINALIZED_CASE'),
            ('DIRECT_FINALIZE_CASE'),
            ('MANAGE_COURT_ACCESS')
        ) AS p(code);
    END IF;

    -- 4d) STATE_LAWYER on FIRST_INSTANCE / DAMASCUS
    SELECT id INTO v_user_state_lawyer FROM users WHERE username = 'lawyer_fi_dam';
    IF v_user_state_lawyer IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('lawyer_fi_dam', 'محامي دولة - بداية دمشق (تجريبي)', '0000000004', v_admin_hash,
                TRUE, FALSE, v_branch_id, v_dept_fi_id, now())
        RETURNING id INTO v_user_state_lawyer;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_user_state_lawyer, v_role_state_lawyer);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_user_state_lawyer, v_branch_id, v_dept_fi_id, 'STATE_LAWYER', TRUE, TRUE);
    END IF;

    -- 4e) READ_ONLY_SUPERVISOR (no membership needed — read-only superpower)
    SELECT id INTO v_user_read_only FROM users WHERE username = 'viewer';
    IF v_user_read_only IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('viewer', 'مشرف اطلاع (تجريبي)', '0000000005', v_admin_hash,
                TRUE, FALSE, NULL, NULL, now())
        RETURNING id INTO v_user_read_only;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_user_read_only, v_role_read_only);
    END IF;

    RAISE NOTICE '== Test users ready ==';
    RAISE NOTICE 'All passwords = ChangeMe!2026 (same as admin).';
    RAISE NOTICE 'Branch: DAMASCUS (id=%) — Department FIRST_INSTANCE (id=%)', v_branch_id, v_dept_fi_id;
END $$;

