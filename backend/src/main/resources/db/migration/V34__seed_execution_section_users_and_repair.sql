-- ============================================================
-- V34: Customer feedback round-3 — execution-section demo users + repair.
-- ============================================================
-- The client requires that "section head of First Instance must not see
-- execution files; only the EXECUTION section head sees them". The backend
-- already scopes by department membership, but the demo had two gaps that
-- masked this:
--
--   1. There was no SECTION_HEAD / ADMIN_CLERK seeded under the EXECUTION
--      department, so the positive side of the rule could not be shown.
--   2. The demo execution file (V22 §7) was created under FIRST_INSTANCE
--      instead of EXECUTION, which let `section_fi_dam` see it by accident.
--
-- This migration (a) seeds `section_exec_dam` + `clerk_exec_dam` under
-- DAMASCUS / EXECUTION, and (b) repoints any existing execution_files row
-- still sitting in a non-EXECUTION department to the matching branch's
-- EXECUTION department (idempotent for fresh DBs where V22 is already
-- correct).
--
-- ⚠️  DEMO-ONLY. Remove this file before production deployment. ⚠️
-- ============================================================

DO $$
DECLARE
    v_branch_id           BIGINT;
    v_dept_exec_id        BIGINT;
    v_admin_hash          VARCHAR(100);
    v_role_section_head   BIGINT;
    v_role_admin_clerk    BIGINT;
    v_user_section_exec   BIGINT;
    v_user_clerk_exec     BIGINT;
BEGIN
    -- Tolerate first-ever boot (BootstrapAdminRunner has not seeded `admin` yet).
    SELECT password_hash INTO v_admin_hash FROM users WHERE username = 'admin';
    IF v_admin_hash IS NULL THEN
        RAISE NOTICE 'V34 dev seed: admin user not yet bootstrapped — skipping.';
        RETURN;
    END IF;

    SELECT id INTO v_branch_id    FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept_exec_id FROM departments WHERE branch_id = v_branch_id AND type = 'EXECUTION';

    IF v_branch_id IS NULL OR v_dept_exec_id IS NULL THEN
        RAISE NOTICE 'V34: DAMASCUS / EXECUTION not found — skipping.';
        RETURN;
    END IF;

    SELECT id INTO v_role_section_head FROM roles WHERE type = 'SECTION_HEAD';
    SELECT id INTO v_role_admin_clerk  FROM roles WHERE type = 'ADMIN_CLERK';

    -- ---- SECTION_HEAD of EXECUTION / DAMASCUS ----------------------------
    SELECT id INTO v_user_section_exec FROM users WHERE username = 'section_exec_dam';
    IF v_user_section_exec IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('section_exec_dam', 'رئيس قسم التنفيذ - دمشق (تجريبي)', '0000000010', v_admin_hash,
                TRUE, FALSE, v_branch_id, v_dept_exec_id, now())
        RETURNING id INTO v_user_section_exec;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_user_section_exec, v_role_section_head);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_user_section_exec, v_branch_id, v_dept_exec_id, 'SECTION_HEAD', TRUE, TRUE);

        RAISE NOTICE 'V34: created section_exec_dam (id=%)', v_user_section_exec;
    END IF;

    -- ---- ADMIN_CLERK of EXECUTION / DAMASCUS -----------------------------
    SELECT id INTO v_user_clerk_exec FROM users WHERE username = 'clerk_exec_dam';
    IF v_user_clerk_exec IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('clerk_exec_dam', 'موظف إداري - تنفيذ دمشق (تجريبي)', '0000000011', v_admin_hash,
                TRUE, FALSE, v_branch_id, v_dept_exec_id, now())
        RETURNING id INTO v_user_clerk_exec;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_user_clerk_exec, v_role_admin_clerk);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_user_clerk_exec, v_branch_id, v_dept_exec_id, 'ADMIN_CLERK', TRUE, TRUE);

        RAISE NOTICE 'V34: created clerk_exec_dam (id=%)', v_user_clerk_exec;
    END IF;

    -- ---- Repair execution_files rows still sitting in a non-EXECUTION dept
    --      For each branch that has an EXECUTION department, re-home any
    --      execution_files row whose department does not match.
    UPDATE execution_files ef
       SET department_id = d_exec.id
      FROM departments d_exec
     WHERE d_exec.type = 'EXECUTION'
       AND d_exec.branch_id = ef.branch_id
       AND ef.department_id <> d_exec.id;

    RAISE NOTICE 'V34: execution-section users + repair complete.';
END $$;
