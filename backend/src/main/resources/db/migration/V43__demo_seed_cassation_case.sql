-- ============================================================
-- V43: Client feedback — demo cassation record (the example from the PDF).
--
-- Seeds the single illustrative طعن نقض row so the قسم النقض register isn't
-- empty in the demo. Fully guarded: skips silently if the Damascus CASSATION
-- department / chamber court / a seed user don't exist yet, or if the row is
-- already present.
--
-- ⚠️  DEMO/DEV ONLY — remove before production. ⚠️
-- ============================================================

DO $$
DECLARE
    v_branch BIGINT;
    v_dept   BIGINT;
    v_court  BIGINT;
    v_user   BIGINT;
    v_case   BIGINT;
    v_stage  BIGINT;
    v_now    TIMESTAMPTZ := now();
    v_date   DATE := DATE '2026-06-06';
BEGIN
    SELECT id INTO v_branch FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept   FROM departments WHERE branch_id = v_branch AND type = 'CASSATION';
    SELECT id INTO v_court  FROM courts      WHERE branch_id = v_branch
                                               AND department_type = 'CASSATION'
                                               AND name_ar = 'الغرفة الجزائية الأولى';
    SELECT id INTO v_user   FROM users WHERE username = 'admin';
    IF v_user IS NULL THEN
        SELECT id INTO v_user FROM users ORDER BY id LIMIT 1;
    END IF;

    IF v_branch IS NULL OR v_dept IS NULL OR v_court IS NULL OR v_user IS NULL THEN
        RAISE NOTICE 'V43: cassation demo prerequisites missing — skipping';
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM litigation_cases
                WHERE created_department_id = v_dept AND circulation_number = '43') THEN
        RAISE NOTICE 'V43: cassation demo row already present — skipping';
        RETURN;
    END IF;

    INSERT INTO litigation_cases (
        public_entity_name, public_entity_position, opponent_name,
        original_basis_number, basis_year, original_registration_date,
        created_branch_id, created_department_id, created_court_id,
        chamber_name, circulation_number, capacity, appeal_result,
        court_type, lifecycle_status, created_by_user_id,
        created_at, updated_at, last_hearing_date, version)
    VALUES (
        'السورية للاتصالات', 'PLAINTIFF', 'سمير البدور',
        '654', 2026, v_date,
        v_branch, v_dept, v_court,
        'الغرفة الجزائية الأولى', '43', 'طاعن', 'قبول الطعن موضوعاً',
        'GENERAL', 'ACTIVE', v_user,
        v_now, v_now, v_date, 0)
    RETURNING id INTO v_case;

    INSERT INTO case_stages (
        litigation_case_id, stage_type, branch_id, department_id, court_id,
        chamber_name, stage_basis_number, stage_year, stage_status,
        is_read_only, first_hearing_date, first_postponement_reason, started_at, version)
    VALUES (
        v_case, 'SINGLE_INSTANCE', v_branch, v_dept, v_court,
        'الغرفة الجزائية الأولى', '654', 2026, 'REGISTERED',
        FALSE, v_date, 'تدقيق', v_now, 0)
    RETURNING id INTO v_stage;

    UPDATE litigation_cases SET current_stage_id = v_stage WHERE id = v_case;
    RAISE NOTICE 'V43: seeded cassation demo case #%', v_case;
END $$;
