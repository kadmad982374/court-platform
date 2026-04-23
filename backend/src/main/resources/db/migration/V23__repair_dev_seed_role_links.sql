-- ============================================================
-- V23: REPAIR — backfill role links / primary memberships /
--      delegated permissions for V20 + V21 dev/demo users.
-- ============================================================
-- Why this migration exists
-- -------------------------
-- V20 and V21 wrap their `INSERT INTO user_roles ...` and
-- `INSERT INTO user_department_memberships ...` calls *inside*
-- `IF v_user_xxx IS NULL THEN ... END IF;` blocks. So the
-- second time those scripts run after a partial seed (e.g. the
-- user row was inserted on a previous boot but the role link
-- failed for some other reason, or was wiped manually), the
-- user is found, the IS NULL branch is skipped, and the
-- role / membership / delegation INSERTs never execute.
--
-- The Playwright demo run (2026-04-19) hit exactly this:
--     loginAs(lawyer_fi_dam): authenticated but the sidebar
--     collapsed — /users/me returned a user with no roles
--     the FE recognises.
--
-- This migration is purely additive and idempotent: for every
-- known dev/demo username we ensure the expected role link,
-- primary department membership, and (for ADMIN_CLERK)
-- delegated permission set are present.
--
-- ⚠️  REMOVE THIS FILE BEFORE DEPLOYING TO PRODUCTION. ⚠️
-- ============================================================

DO $$
DECLARE
    v_branch_dam_id     BIGINT;
    v_dept_fi_id        BIGINT;
    v_dept_appeal_id    BIGINT;

    v_role_branch_head  BIGINT;
    v_role_section_head BIGINT;
    v_role_admin_clerk  BIGINT;
    v_role_state_lawyer BIGINT;
    v_role_read_only    BIGINT;

    v_section_head_id   BIGINT;

    -- (username, role_id, branch_id, dept_id, membership_type, is_active)
    rec RECORD;
BEGIN
    -- If admin hasn't been bootstrapped yet, V20 also exits early —
    -- nothing to repair on a brand-new DB.
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
        RAISE NOTICE 'V23 repair: admin not bootstrapped yet — nothing to repair.';
        RETURN;
    END IF;

    SELECT id INTO v_branch_dam_id  FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept_fi_id     FROM departments WHERE branch_id = v_branch_dam_id AND type = 'FIRST_INSTANCE';
    SELECT id INTO v_dept_appeal_id FROM departments WHERE branch_id = v_branch_dam_id AND type = 'APPEAL';

    SELECT id INTO v_role_branch_head   FROM roles WHERE type = 'BRANCH_HEAD';
    SELECT id INTO v_role_section_head  FROM roles WHERE type = 'SECTION_HEAD';
    SELECT id INTO v_role_admin_clerk   FROM roles WHERE type = 'ADMIN_CLERK';
    SELECT id INTO v_role_state_lawyer  FROM roles WHERE type = 'STATE_LAWYER';
    SELECT id INTO v_role_read_only     FROM roles WHERE type = 'READ_ONLY_SUPERVISOR';

    SELECT id INTO v_section_head_id    FROM users WHERE username = 'section_fi_dam';

    -- ---------------------------------------------------------------
    -- 1) Backfill role links
    -- ---------------------------------------------------------------
    FOR rec IN (
        SELECT * FROM (VALUES
            ('head_dam',           'BRANCH_HEAD'),
            ('section_fi_dam',     'SECTION_HEAD'),
            ('clerk_fi_dam',       'ADMIN_CLERK'),
            ('clerk2_fi_dam',      'ADMIN_CLERK'),
            ('lawyer_fi_dam',      'STATE_LAWYER'),
            ('lawyer2_fi_dam',     'STATE_LAWYER'),
            ('lawyer_inactive_fi', 'STATE_LAWYER'),
            ('lawyer_app_dam',     'STATE_LAWYER'),
            ('viewer',             'READ_ONLY_SUPERVISOR')
        ) AS t(uname, rtype)
    ) LOOP
        INSERT INTO user_roles (user_id, role_id)
        SELECT u.id, r.id
        FROM users u
        JOIN roles r ON r.type = rec.rtype
        WHERE u.username = rec.uname
          AND NOT EXISTS (
              SELECT 1 FROM user_roles ur
              WHERE ur.user_id = u.id AND ur.role_id = r.id
          );
    END LOOP;

    -- ---------------------------------------------------------------
    -- 2) Backfill primary department memberships
    --    (only if the user exists AND has no membership yet)
    -- ---------------------------------------------------------------

    -- BRANCH_HEAD: branch-wide, no department
    INSERT INTO user_department_memberships
        (user_id, branch_id, department_id, membership_type, is_primary, is_active)
    SELECT u.id, v_branch_dam_id, NULL, 'BRANCH_HEAD', TRUE, TRUE
    FROM users u
    WHERE u.username = 'head_dam'
      AND v_branch_dam_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM user_department_memberships m
          WHERE m.user_id = u.id AND m.membership_type = 'BRANCH_HEAD'
      );

    -- FIRST_INSTANCE / DAMASCUS users
    FOR rec IN (
        SELECT * FROM (VALUES
            ('section_fi_dam', 'SECTION_HEAD'),
            ('clerk_fi_dam',   'ADMIN_CLERK'),
            ('clerk2_fi_dam',  'ADMIN_CLERK'),
            ('lawyer_fi_dam',  'STATE_LAWYER'),
            ('lawyer2_fi_dam', 'STATE_LAWYER'),
            ('lawyer_inactive_fi', 'STATE_LAWYER')
        ) AS t(uname, mtype)
    ) LOOP
        INSERT INTO user_department_memberships
            (user_id, branch_id, department_id, membership_type, is_primary, is_active)
        SELECT u.id, v_branch_dam_id, v_dept_fi_id, rec.mtype, TRUE, TRUE
        FROM users u
        WHERE u.username = rec.uname
          AND v_branch_dam_id IS NOT NULL
          AND v_dept_fi_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM user_department_memberships m
              WHERE m.user_id = u.id
                AND m.branch_id = v_branch_dam_id
                AND m.department_id = v_dept_fi_id
                AND m.membership_type = rec.mtype
          );
    END LOOP;

    -- APPEAL / DAMASCUS lawyer
    INSERT INTO user_department_memberships
        (user_id, branch_id, department_id, membership_type, is_primary, is_active)
    SELECT u.id, v_branch_dam_id, v_dept_appeal_id, 'STATE_LAWYER', TRUE, TRUE
    FROM users u
    WHERE u.username = 'lawyer_app_dam'
      AND v_branch_dam_id IS NOT NULL
      AND v_dept_appeal_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM user_department_memberships m
          WHERE m.user_id = u.id
            AND m.branch_id = v_branch_dam_id
            AND m.department_id = v_dept_appeal_id
            AND m.membership_type = 'STATE_LAWYER'
      );

    -- ---------------------------------------------------------------
    -- 3) Repair: lawyer_inactive_fi must remain inactive (V21 intent)
    -- ---------------------------------------------------------------
    UPDATE users
       SET is_active = FALSE
     WHERE username = 'lawyer_inactive_fi'
       AND is_active <> FALSE;

    -- ---------------------------------------------------------------
    -- 4) Backfill clerk_fi_dam delegated permissions (full set, D-004)
    -- ---------------------------------------------------------------
    IF v_section_head_id IS NOT NULL THEN
        INSERT INTO user_delegated_permissions
            (user_id, permission_code, granted, granted_by_user_id, granted_at)
        SELECT u.id, p.code, TRUE, v_section_head_id, now()
        FROM users u
        CROSS JOIN (VALUES
            ('CREATE_CASE'),
            ('EDIT_CASE_BASIC_DATA'),
            ('ASSIGN_LAWYER'),
            ('PROMOTE_TO_APPEAL'),
            ('PROMOTE_TO_EXECUTION'),
            ('ADD_EXECUTION_STEP'),
            ('CORRECT_FINALIZED_CASE'),
            ('DIRECT_FINALIZE_CASE'),
            ('MANAGE_COURT_ACCESS')
        ) AS p(code)
        WHERE u.username = 'clerk_fi_dam'
          AND NOT EXISTS (
              SELECT 1 FROM user_delegated_permissions d
              WHERE d.user_id = u.id AND d.permission_code = p.code
          );

        -- clerk2_fi_dam: same set EXCEPT ASSIGN_LAWYER (V21 intent)
        INSERT INTO user_delegated_permissions
            (user_id, permission_code, granted, granted_by_user_id, granted_at)
        SELECT u.id, p.code, TRUE, v_section_head_id, now()
        FROM users u
        CROSS JOIN (VALUES
            ('CREATE_CASE'),
            ('EDIT_CASE_BASIC_DATA'),
            ('PROMOTE_TO_APPEAL'),
            ('PROMOTE_TO_EXECUTION'),
            ('ADD_EXECUTION_STEP'),
            ('CORRECT_FINALIZED_CASE'),
            ('DIRECT_FINALIZE_CASE'),
            ('MANAGE_COURT_ACCESS')
        ) AS p(code)
        WHERE u.username = 'clerk2_fi_dam'
          AND NOT EXISTS (
              SELECT 1 FROM user_delegated_permissions d
              WHERE d.user_id = u.id AND d.permission_code = p.code
          );
    END IF;

    RAISE NOTICE 'V23 repair: dev/demo role links + memberships + delegations backfilled.';
END $$;

