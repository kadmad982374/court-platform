-- V30: Customer feedback round-2 — demo a multi-section lawyer.
--
-- The customer noted that ~50% of state lawyers belong to two sections at
-- once (e.g. one at FIRST_INSTANCE and one at APPEAL). The new section
-- picker on the cases page only renders when the logged-in user has 2+
-- STATE_LAWYER memberships, so to make the feature visible in the demo we
-- give `lawyer_fi_dam` a second active membership in DAMASCUS / APPEAL
-- (in addition to their existing DAMASCUS / FIRST_INSTANCE one) and also
-- grant them court-access to the APPEAL court so they can read appeal
-- stages of cases assigned to them.

DO $$
DECLARE
    v_user_id      BIGINT;
    v_grantor_id   BIGINT;
    v_branch_id    BIGINT;
    v_dept_app_id  BIGINT;
    v_court_app_id BIGINT;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE username = 'lawyer_fi_dam';
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'V30: lawyer_fi_dam not found — skipping multi-section seed';
        RETURN;
    END IF;

    -- Any existing user can be the grantor — admin if it exists, else the lawyer themselves.
    SELECT id INTO v_grantor_id FROM users WHERE username = 'admin';
    IF v_grantor_id IS NULL THEN
        v_grantor_id := v_user_id;
    END IF;

    SELECT id INTO v_branch_id  FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept_app_id FROM departments WHERE branch_id = v_branch_id AND type = 'APPEAL';

    -- Add the second STATE_LAWYER membership (DAMASCUS / APPEAL) if not present.
    INSERT INTO user_department_memberships (user_id, branch_id, department_id, membership_type, is_primary, is_active)
    SELECT v_user_id, v_branch_id, v_dept_app_id, 'STATE_LAWYER', FALSE, TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM user_department_memberships
         WHERE user_id = v_user_id
           AND branch_id = v_branch_id
           AND department_id = v_dept_app_id
           AND membership_type = 'STATE_LAWYER'
    );

    -- Grant court-access to the first active APPEAL court in DAMASCUS so the
    -- lawyer can actually read appeal stages assigned to them.
    SELECT id INTO v_court_app_id
      FROM courts
     WHERE branch_id = v_branch_id
       AND department_type = 'APPEAL'
       AND is_active = TRUE
     ORDER BY id
     LIMIT 1;

    IF v_court_app_id IS NOT NULL THEN
        INSERT INTO user_court_access (user_id, court_id, granted_by_user_id, granted_at, is_active)
        SELECT v_user_id, v_court_app_id, v_grantor_id, NOW(), TRUE
        WHERE NOT EXISTS (
            SELECT 1 FROM user_court_access
             WHERE user_id = v_user_id AND court_id = v_court_app_id
        );
    END IF;
END $$;
