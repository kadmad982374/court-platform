-- ============================================================
-- V25: Seed Case — FI-FINALIZED, promote-to-appeal ready.
-- ============================================================
-- Provides a case in lifecycle=ACTIVE with its current
-- FIRST_INSTANCE stage in stage_status=FINALIZED and
-- is_read_only=FALSE so that the promote-to-appeal UI flow
-- can be exercised end-to-end in Playwright tests.
--
-- REMOVE BEFORE PRODUCTION (along with V20-V24).
-- ============================================================

DO $$
DECLARE
    v_branch_id    BIGINT;
    v_dept_fi_id   BIGINT;
    v_court_fi_id  BIGINT;
    v_section_id   BIGINT;
    v_lawyer1_id   BIGINT;
    v_case_id      BIGINT;
    v_stage_id     BIGINT;
    v_now          TIMESTAMPTZ := now();
BEGIN
    SELECT id INTO v_section_id FROM users WHERE username = 'section_fi_dam';
    IF v_section_id IS NULL THEN
        RAISE NOTICE 'V25: section_fi_dam not found — skipping.';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM litigation_cases WHERE original_basis_number = 'DEMO-FI-FINAL-006') THEN
        RAISE NOTICE 'V25: Case (DEMO-FI-FINAL-006) already exists — skipping.';
        RETURN;
    END IF;

    SELECT id INTO v_branch_id  FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept_fi_id FROM departments WHERE branch_id = v_branch_id AND type = 'FIRST_INSTANCE';
    SELECT id INTO v_court_fi_id FROM courts     WHERE branch_id = v_branch_id AND department_type = 'FIRST_INSTANCE' LIMIT 1;
    SELECT id INTO v_lawyer1_id FROM users       WHERE username = 'lawyer_fi_dam';

    -- Case row
    INSERT INTO litigation_cases
        (public_entity_name, public_entity_position, opponent_name,
         original_basis_number, basis_year, original_registration_date,
         created_branch_id, created_department_id, created_court_id,
         current_stage_id, current_owner_user_id, lifecycle_status,
         created_by_user_id, created_at, updated_at)
    VALUES
        ('وزارة الاختبار', 'PLAINTIFF', 'شركة الخصم التجريبية',
         'DEMO-FI-FINAL-006', 2025, '2025-06-01',
         v_branch_id, v_dept_fi_id, v_court_fi_id,
         NULL, v_lawyer1_id, 'ACTIVE',
         v_section_id, v_now - interval '300 days', v_now - interval '5 days')
    RETURNING id INTO v_case_id;

    -- Stage: FIRST_INSTANCE — FINALIZED, NOT read-only
    INSERT INTO case_stages
        (litigation_case_id, stage_type, branch_id, department_id, court_id,
         stage_basis_number, stage_year, assigned_lawyer_user_id,
         stage_status, parent_stage_id, is_read_only,
         first_hearing_date, first_postponement_reason,
         started_at, ended_at)
    VALUES
        (v_case_id, 'FIRST_INSTANCE', v_branch_id, v_dept_fi_id, v_court_fi_id,
         'S-DEMO-006-FI', 2025, v_lawyer1_id,
         'FINALIZED', NULL, FALSE,
         '2025-07-01', 'تبليغ الأطراف',
         v_now - interval '300 days', v_now - interval '5 days')
    RETURNING id INTO v_stage_id;

    UPDATE litigation_cases SET current_stage_id = v_stage_id WHERE id = v_case_id;

    -- Decision
    INSERT INTO case_decisions
        (case_stage_id, decision_number, decision_date, decision_type,
         adjudged_amount, currency_code, summary_notes,
         finalized_by_user_id, finalized_at)
    VALUES
        (v_stage_id, 'D-2025-006-FI', '2026-04-15', 'FOR_ENTITY',
         500000.00, 'SYP', 'قرار الدرجة الأولى — لصالح الجهة. جاهز للاستئناف.',
         v_lawyer1_id, v_now - interval '5 days');

    -- Hearing history
    INSERT INTO hearing_progression_entries
        (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
         entered_by_user_id, entry_type, created_at)
    VALUES
        (v_stage_id, '2025-07-01', 'NOTIFY_PARTIES_PERSONAL', 'تبليغ الأطراف',
         v_section_id, 'INITIAL', v_now - interval '300 days'),
        (v_stage_id, '2026-04-15', NULL, 'الفصل — لصالح الجهة',
         v_lawyer1_id, 'FINALIZED', v_now - interval '5 days');

    RAISE NOTICE '====================================================';
    RAISE NOTICE 'V25: Case (DEMO-FI-FINAL-006) created — id=%', v_case_id;
    RAISE NOTICE '     lifecycle=ACTIVE, FI stage=FINALIZED, is_read_only=FALSE';
    RAISE NOTICE '     Ready for promote-to-appeal Playwright test.';
    RAISE NOTICE '====================================================';
END $$;

