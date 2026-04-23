-- ============================================================
-- V21: Mini-Phase A (Assign Lawyer) — additional dev seed users.
-- ============================================================
-- Augments V20 (does NOT modify it; Flyway checksums on V20 stay intact)
-- with the test users required to exercise GET /api/v1/users for the
-- assignable-lawyer dropdown end-to-end:
--
--   * lawyer2_fi_dam        : 2nd ACTIVE  STATE_LAWYER  in DAMASCUS / FIRST_INSTANCE
--   * lawyer_inactive_fi    : INACTIVE    STATE_LAWYER  in DAMASCUS / FIRST_INSTANCE
--                             (user.is_active=false → must be excluded by
--                              activeOnly=true)
--   * lawyer_app_dam        : ACTIVE      STATE_LAWYER  in DAMASCUS / APPEAL
--                             (different department → must be excluded by
--                              the departmentId filter)
--   * clerk2_fi_dam         : ACTIVE      ADMIN_CLERK   in DAMASCUS / FIRST_INSTANCE
--                             *without* the ASSIGN_LAWYER delegation
--                             (must receive 403 from the new endpoint).
--
-- Tolerant: if 'admin' has not been bootstrapped yet, exits silently and
-- the next boot picks it up (mirrors V20's contract).
-- Idempotent: re-running is safe.
--
-- Reference:
--   docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
--   docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-046)
--
-- ⚠️  REMOVE THIS FILE BEFORE DEPLOYING TO PRODUCTION (along with V20). ⚠️
-- ============================================================

DO $$
DECLARE
    v_branch_id          BIGINT;
    v_dept_fi_id         BIGINT;
    v_dept_appeal_id     BIGINT;
    v_admin_hash         VARCHAR(100);
    v_role_admin_clerk   BIGINT;
    v_role_state_lawyer  BIGINT;
    v_section_head_id    BIGINT;

    v_uid                BIGINT;
BEGIN
    -- Tolerate first-ever boot.
    SELECT password_hash INTO v_admin_hash FROM users WHERE username = 'admin';
    IF v_admin_hash IS NULL THEN
        RAISE NOTICE 'V21 dev seed: admin user not yet bootstrapped — skipping.';
        RETURN;
    END IF;

    SELECT id INTO v_branch_id      FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept_fi_id     FROM departments WHERE branch_id = v_branch_id AND type = 'FIRST_INSTANCE';
    SELECT id INTO v_dept_appeal_id FROM departments WHERE branch_id = v_branch_id AND type = 'APPEAL';

    SELECT id INTO v_role_admin_clerk  FROM roles WHERE type = 'ADMIN_CLERK';
    SELECT id INTO v_role_state_lawyer FROM roles WHERE type = 'STATE_LAWYER';

    -- Section head from V20 (used as granter for clerk delegations).
    SELECT id INTO v_section_head_id FROM users WHERE username = 'section_fi_dam';

    -- ---------- 1) lawyer2_fi_dam — second active lawyer in same dept ----------
    SELECT id INTO v_uid FROM users WHERE username = 'lawyer2_fi_dam';
    IF v_uid IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('lawyer2_fi_dam', 'محامي دولة 2 - بداية دمشق (تجريبي)', '0000000006', v_admin_hash,
                TRUE, FALSE, v_branch_id, v_dept_fi_id, now())
        RETURNING id INTO v_uid;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_uid, v_role_state_lawyer);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_uid, v_branch_id, v_dept_fi_id, 'STATE_LAWYER', TRUE, TRUE);
    END IF;

    -- ---------- 2) lawyer_inactive_fi — same dept but user.is_active=false ----------
    SELECT id INTO v_uid FROM users WHERE username = 'lawyer_inactive_fi';
    IF v_uid IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('lawyer_inactive_fi', 'محامي معطّل - بداية دمشق (تجريبي)', '0000000007', v_admin_hash,
                FALSE, FALSE, v_branch_id, v_dept_fi_id, now())
        RETURNING id INTO v_uid;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_uid, v_role_state_lawyer);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_uid, v_branch_id, v_dept_fi_id, 'STATE_LAWYER', TRUE, TRUE);
    END IF;

    -- ---------- 3) lawyer_app_dam — different department (APPEAL) ----------
    IF v_dept_appeal_id IS NOT NULL THEN
        SELECT id INTO v_uid FROM users WHERE username = 'lawyer_app_dam';
        IF v_uid IS NULL THEN
            INSERT INTO users (username, full_name, mobile_number, password_hash,
                               is_active, is_locked, default_branch_id, default_department_id, created_at)
            VALUES ('lawyer_app_dam', 'محامي دولة - استئناف دمشق (تجريبي)', '0000000008', v_admin_hash,
                    TRUE, FALSE, v_branch_id, v_dept_appeal_id, now())
            RETURNING id INTO v_uid;

            INSERT INTO user_roles (user_id, role_id) VALUES (v_uid, v_role_state_lawyer);
            INSERT INTO user_department_memberships
                (user_id, branch_id, department_id, membership_type, is_primary, is_active)
            VALUES
                (v_uid, v_branch_id, v_dept_appeal_id, 'STATE_LAWYER', TRUE, TRUE);
        END IF;
    END IF;

    -- ---------- 4) clerk2_fi_dam — ADMIN_CLERK WITHOUT ASSIGN_LAWYER ----------
    SELECT id INTO v_uid FROM users WHERE username = 'clerk2_fi_dam';
    IF v_uid IS NULL THEN
        INSERT INTO users (username, full_name, mobile_number, password_hash,
                           is_active, is_locked, default_branch_id, default_department_id, created_at)
        VALUES ('clerk2_fi_dam', 'موظف إداري بدون تفويض الإسناد - بداية دمشق (تجريبي)',
                '0000000009', v_admin_hash,
                TRUE, FALSE, v_branch_id, v_dept_fi_id, now())
        RETURNING id INTO v_uid;

        INSERT INTO user_roles (user_id, role_id) VALUES (v_uid, v_role_admin_clerk);
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        VALUES
            (v_uid, v_branch_id, v_dept_fi_id, 'ADMIN_CLERK', TRUE, TRUE);

        -- All standard delegations EXCEPT ASSIGN_LAWYER (so this clerk can
        -- still create cases for the demo, but must be denied by the new
        -- assignable-lawyers endpoint).
        INSERT INTO user_delegated_permissions
            (user_id, permission_code, granted, granted_by_user_id, granted_at)
        SELECT v_uid, code, TRUE, v_section_head_id, now()
        FROM (VALUES
            ('CREATE_CASE'),
            ('EDIT_CASE_BASIC_DATA'),
            ('PROMOTE_TO_APPEAL'),
            ('PROMOTE_TO_EXECUTION'),
            ('ADD_EXECUTION_STEP'),
            ('CORRECT_FINALIZED_CASE'),
            ('DIRECT_FINALIZE_CASE'),
            ('MANAGE_COURT_ACCESS')
        ) AS p(code);
    END IF;

    RAISE NOTICE 'V21 dev seed: assign-lawyer demo users ready (password = ChangeMe!2026).';
END $$;

