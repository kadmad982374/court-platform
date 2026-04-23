-- ============================================================
-- V24: Seed Case 5 — appeal-FINALIZED, promote-to-execution ready.
-- ============================================================
-- Why this migration exists
-- -------------------------
-- V22 Case 4 is already IN_EXECUTION (pre-promoted by that seed).
-- The Playwright E2E suite needs at least one case that is in
-- lifecycle=IN_APPEAL with its current (APPEAL) stage in
-- stage_status=FINALIZED and is_read_only=FALSE so that the
-- promote-to-execution UI flow can be exercised end-to-end.
--
-- Case 5 (DEMO-APPEAL-FINAL-005) provides exactly that state.
--
-- Notes on idempotency
-- --------------------
--   • The outer check (original_basis_number) is idempotent on re-apply.
--   • A Playwright run that successfully promotes Case 5 will change
--     its stage to PROMOTED_TO_EXECUTION; subsequent Playwright runs
--     receive a 409 STAGE_ALREADY_PROMOTED from the backend.
--     The test in 10-known-gaps.spec.ts handles both outcomes.
--
-- REMOVE BEFORE PRODUCTION (along with V20-V23).
-- ============================================================

DO $$
DECLARE
    v_branch_id       BIGINT;
    v_dept_fi_id      BIGINT;
    v_dept_appeal_id  BIGINT;
    v_court_fi_id     BIGINT;
    v_court_appeal_id BIGINT;

    v_section_id      BIGINT;
    v_lawyer1_id      BIGINT;
    v_lawyer_app_id   BIGINT;

    v_case5_id        BIGINT;
    v_stage5a_id      BIGINT;
    v_stage5b_id      BIGINT;

    v_now             TIMESTAMPTZ := now();
BEGIN
    -- Guard: skip if demo users don't exist yet.
    SELECT id INTO v_section_id FROM users WHERE username = 'section_fi_dam';
    IF v_section_id IS NULL THEN
        RAISE NOTICE 'V24: section_fi_dam not found — skipping.';
        RETURN;
    END IF;

    SELECT id INTO v_branch_id       FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept_fi_id      FROM departments WHERE branch_id = v_branch_id AND type = 'FIRST_INSTANCE';
    SELECT id INTO v_dept_appeal_id  FROM departments WHERE branch_id = v_branch_id AND type = 'APPEAL';
    SELECT id INTO v_court_fi_id     FROM courts      WHERE branch_id = v_branch_id AND department_type = 'FIRST_INSTANCE' LIMIT 1;
    SELECT id INTO v_court_appeal_id FROM courts      WHERE branch_id = v_branch_id AND department_type = 'APPEAL'         LIMIT 1;

    SELECT id INTO v_lawyer1_id   FROM users WHERE username = 'lawyer_fi_dam';
    SELECT id INTO v_lawyer_app_id FROM users WHERE username = 'lawyer_app_dam';

    -- ==============================================================
    -- CASE 5 — FI-finalized + Appeal-FINALIZED, promote-to-execution
    -- ==============================================================
    IF EXISTS (SELECT 1 FROM litigation_cases WHERE original_basis_number = 'DEMO-APPEAL-FINAL-005') THEN
        RAISE NOTICE 'V24: Case 5 (DEMO-APPEAL-FINAL-005) already exists — skipping.';
        RETURN;
    END IF;

    -- ── litigation_cases row ──────────────────────────────────────
    -- created_department_id = FIRST_INSTANCE so that section_fi_dam
    -- (whose membership is DAMASCUS/FIRST_INSTANCE) passes the
    -- requireCaseManagement check in ExecutionService.
    INSERT INTO litigation_cases
        (public_entity_name, public_entity_position, opponent_name,
         original_basis_number, basis_year, original_registration_date,
         created_branch_id, created_department_id, created_court_id,
         current_stage_id, current_owner_user_id, lifecycle_status,
         created_by_user_id, created_at, updated_at)
    VALUES
        ('وزارة الإطار التجريبي', 'PLAINTIFF', 'شركة التنفيذ التجريبية',
         'DEMO-APPEAL-FINAL-005', 2025, '2025-09-01',
         v_branch_id, v_dept_fi_id, v_court_fi_id,
         NULL,                  -- filled in below
         v_lawyer_app_id,       -- appeal lawyer is the current owner
         'IN_APPEAL',
         v_section_id, v_now - interval '200 days', v_now - interval '3 days')
    RETURNING id INTO v_case5_id;

    -- ── Stage 5a: FIRST_INSTANCE — finalized, promoted to appeal ─
    INSERT INTO case_stages
        (litigation_case_id, stage_type, branch_id, department_id, court_id,
         stage_basis_number, stage_year, assigned_lawyer_user_id,
         stage_status, parent_stage_id, is_read_only,
         first_hearing_date, first_postponement_reason,
         started_at, ended_at)
    VALUES
        (v_case5_id, 'FIRST_INSTANCE', v_branch_id, v_dept_fi_id, v_court_fi_id,
         'S-DEMO-005-FI', 2025, v_lawyer1_id,
         'PROMOTED_TO_APPEAL', NULL, TRUE,
         '2025-10-01', 'تبليغ الأطراف شخصياً',
         v_now - interval '200 days', v_now - interval '120 days')
    RETURNING id INTO v_stage5a_id;

    -- Decision for Stage 5a
    INSERT INTO case_decisions
        (case_stage_id, decision_number, decision_date, decision_type,
         adjudged_amount, currency_code, summary_notes,
         finalized_by_user_id, finalized_at)
    VALUES
        (v_stage5a_id, 'D-2025-005-FI', '2025-12-20', 'AGAINST_ENTITY',
         300000.00, 'SYP', 'قرار الدرجة الأولى — صدر ضد الجهة.',
         v_lawyer1_id, v_now - interval '120 days');

    -- Hearing history for Stage 5a
    INSERT INTO hearing_progression_entries
        (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
         entered_by_user_id, entry_type, created_at)
    VALUES
        (v_stage5a_id, '2025-10-01', 'NOTIFY_PARTIES_PERSONAL', 'تبليغ الأطراف',
         v_section_id, 'INITIAL', v_now - interval '200 days'),
        (v_stage5a_id, '2025-12-20', NULL, 'الفصل — حكم ضد الجهة',
         v_lawyer1_id, 'FINALIZED', v_now - interval '120 days');

    -- ── Stage 5b: APPEAL — FINALIZED, NOT YET PROMOTED (the key!) ─
    -- is_read_only = FALSE  ← this is what makes promote-to-execution possible
    -- stage_status = FINALIZED
    -- Uses APPEAL dept + court so court-access rules for lawyer_app_dam apply.
    INSERT INTO case_stages
        (litigation_case_id, stage_type, branch_id, department_id, court_id,
         stage_basis_number, stage_year, assigned_lawyer_user_id,
         stage_status, parent_stage_id, is_read_only,
         first_hearing_date, first_postponement_reason,
         started_at, ended_at)
    VALUES
        (v_case5_id, 'APPEAL', v_branch_id, v_dept_appeal_id, v_court_appeal_id,
         'S-DEMO-005-APP', 2026, v_lawyer_app_id,
         'FINALIZED', v_stage5a_id, FALSE,
         '2026-01-15', 'انتظار رد الخصم',
         v_now - interval '120 days', v_now - interval '3 days')
    RETURNING id INTO v_stage5b_id;

    -- Set current_stage_id now that Stage 5b exists
    UPDATE litigation_cases SET current_stage_id = v_stage5b_id WHERE id = v_case5_id;

    -- Decision for Stage 5b
    INSERT INTO case_decisions
        (case_stage_id, decision_number, decision_date, decision_type,
         adjudged_amount, currency_code, summary_notes,
         finalized_by_user_id, finalized_at)
    VALUES
        (v_stage5b_id, 'D-2026-005-APP', '2026-04-16', 'FOR_ENTITY',
         600000.00, 'SYP', 'قرار الاستئناف — قضي لصالح الجهة. الملف جاهز للتنفيذ.',
         v_lawyer_app_id, v_now - interval '3 days');

    -- Hearing history for Stage 5b
    INSERT INTO hearing_progression_entries
        (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
         entered_by_user_id, entry_type, created_at)
    VALUES
        (v_stage5b_id, '2026-01-15', 'NOTIFY_PARTIES_FORMAL', 'تبليغ رسمي',
         v_section_id, 'INITIAL', v_now - interval '120 days'),
        (v_stage5b_id, '2026-03-10', 'AUDIT', 'تقييم الأضرار',
         v_lawyer_app_id, 'ROLLOVER', v_now - interval '40 days'),
        (v_stage5b_id, '2026-04-16', NULL, 'الفصل — لصالح الجهة. جاهز للتنفيذ.',
         v_lawyer_app_id, 'FINALIZED', v_now - interval '3 days');

    -- Notification
    INSERT INTO notifications
        (recipient_user_id, notification_type, title, body,
         related_entity_type, related_entity_id, is_read, created_at)
    VALUES
        (v_section_id, 'CASE_REGISTERED', 'قيد قضية جديدة',
         'تم قيد القضية DEMO-APPEAL-FINAL-005 — جاهزة للترقية إلى التنفيذ.',
         'LITIGATION_CASE', v_case5_id, TRUE, v_now - interval '200 days');

    -- Also ensure lawyer_app_dam has court access to the APPEAL court
    -- (defensive — V22 should already have done this).
    IF v_lawyer_app_id IS NOT NULL AND v_court_appeal_id IS NOT NULL THEN
        INSERT INTO user_court_access
            (user_id, court_id, granted_by_user_id, granted_at, is_active)
        VALUES (v_lawyer_app_id, v_court_appeal_id, v_section_id, v_now, TRUE)
        ON CONFLICT (user_id, court_id) DO NOTHING;
    END IF;

    RAISE NOTICE '====================================================';
    RAISE NOTICE 'V24: Case 5 (DEMO-APPEAL-FINAL-005) created — id=%', v_case5_id;
    RAISE NOTICE '     lifecycle=IN_APPEAL, appeal stage=FINALIZED, is_read_only=FALSE';
    RAISE NOTICE '     Ready for promote-to-execution Playwright test.';
    RAISE NOTICE '====================================================';
END $$;

