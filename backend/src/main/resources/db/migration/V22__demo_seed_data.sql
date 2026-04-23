-- ============================================================
-- V22: Demo Seed Data — comprehensive E2E testable dataset.
-- ============================================================
-- Fixes BUG-003: adds user_court_access for test lawyers.
-- Creates 4 demo cases at varying lifecycle stages so the full
-- flow can be exercised from the UI or API without manual SQL.
--
-- Pre-requisites: V1..V21 applied, admin + V20/V21 users exist.
-- Idempotent: re-running is safe (checks before insert).
--
-- ⚠️  REMOVE BEFORE PRODUCTION (along with V20/V21). ⚠️
-- ============================================================

DO $$
DECLARE
    v_branch_id          BIGINT;
    v_dept_fi_id         BIGINT;
    v_dept_appeal_id     BIGINT;
    v_dept_exec_id       BIGINT;
    v_court_fi_id        BIGINT;
    v_court_appeal_id    BIGINT;

    v_admin_id           BIGINT;
    v_section_id         BIGINT;
    v_clerk_id           BIGINT;
    v_lawyer1_id         BIGINT;
    v_lawyer2_id         BIGINT;
    v_lawyer_inactive_id BIGINT;
    v_lawyer_app_id      BIGINT;

    -- Case / stage / decision IDs
    v_case1_id           BIGINT;  -- Fresh (assign-ready)
    v_stage1_id          BIGINT;

    v_case2_id           BIGINT;  -- Assigned (rollover/finalize-ready)
    v_stage2_id          BIGINT;

    v_case3_id           BIGINT;  -- Finalized (resolved-register + promote-to-appeal-ready)
    v_stage3_id          BIGINT;

    v_case4_id           BIGINT;  -- Execution-ready (appeal finalized)
    v_stage4a_id         BIGINT;  -- FI stage (finalized)
    v_stage4b_id         BIGINT;  -- Appeal stage (finalized)

    v_exec_file_id       BIGINT;

    v_now                TIMESTAMPTZ := now();
BEGIN
    -- ==================================================================
    -- 0) Tolerate first-ever boot
    -- ==================================================================
    SELECT id INTO v_admin_id FROM users WHERE username = 'admin';
    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'V22 demo seed: admin not yet bootstrapped — skipping.';
        RETURN;
    END IF;

    -- ==================================================================
    -- 1) Look up infrastructure IDs
    -- ==================================================================
    SELECT id INTO v_branch_id       FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept_fi_id      FROM departments WHERE branch_id = v_branch_id AND type = 'FIRST_INSTANCE';
    SELECT id INTO v_dept_appeal_id  FROM departments WHERE branch_id = v_branch_id AND type = 'APPEAL';
    SELECT id INTO v_dept_exec_id    FROM departments WHERE branch_id = v_branch_id AND type = 'EXECUTION';
    SELECT id INTO v_court_fi_id     FROM courts      WHERE branch_id = v_branch_id AND department_type = 'FIRST_INSTANCE' LIMIT 1;
    SELECT id INTO v_court_appeal_id FROM courts      WHERE branch_id = v_branch_id AND department_type = 'APPEAL' LIMIT 1;

    -- Users from V20/V21
    SELECT id INTO v_section_id         FROM users WHERE username = 'section_fi_dam';
    SELECT id INTO v_clerk_id           FROM users WHERE username = 'clerk_fi_dam';
    SELECT id INTO v_lawyer1_id         FROM users WHERE username = 'lawyer_fi_dam';
    SELECT id INTO v_lawyer2_id         FROM users WHERE username = 'lawyer2_fi_dam';
    SELECT id INTO v_lawyer_inactive_id FROM users WHERE username = 'lawyer_inactive_fi';
    SELECT id INTO v_lawyer_app_id      FROM users WHERE username = 'lawyer_app_dam';

    IF v_section_id IS NULL OR v_lawyer1_id IS NULL THEN
        RAISE NOTICE 'V22 demo seed: V20/V21 users missing — skipping.';
        RETURN;
    END IF;

    -- ==================================================================
    -- 2) FIX BUG-003: Add user_court_access for test lawyers
    -- ==================================================================
    -- lawyer_fi_dam → FIRST_INSTANCE court
    INSERT INTO user_court_access (user_id, court_id, granted_by_user_id, granted_at, is_active)
    VALUES (v_lawyer1_id, v_court_fi_id, v_section_id, v_now, TRUE)
    ON CONFLICT (user_id, court_id) DO NOTHING;

    -- lawyer2_fi_dam → FIRST_INSTANCE court
    IF v_lawyer2_id IS NOT NULL THEN
        INSERT INTO user_court_access (user_id, court_id, granted_by_user_id, granted_at, is_active)
        VALUES (v_lawyer2_id, v_court_fi_id, v_section_id, v_now, TRUE)
        ON CONFLICT (user_id, court_id) DO NOTHING;
    END IF;

    -- lawyer_app_dam → APPEAL court
    IF v_lawyer_app_id IS NOT NULL AND v_court_appeal_id IS NOT NULL THEN
        INSERT INTO user_court_access (user_id, court_id, granted_by_user_id, granted_at, is_active)
        VALUES (v_lawyer_app_id, v_court_appeal_id, v_section_id, v_now, TRUE)
        ON CONFLICT (user_id, court_id) DO NOTHING;
    END IF;

    -- lawyer_inactive_fi explicitly gets NO court access (useful for rejection tests).

    RAISE NOTICE 'V22: court access granted for test lawyers (BUG-003 fix).';

    -- ==================================================================
    -- 3) CASE 1 — Fresh, assign-ready (lifecycle=NEW)
    -- ==================================================================
    IF NOT EXISTS (SELECT 1 FROM litigation_cases WHERE original_basis_number = 'DEMO-FRESH-001') THEN
        INSERT INTO litigation_cases
            (public_entity_name, public_entity_position, opponent_name,
             original_basis_number, basis_year, original_registration_date,
             created_branch_id, created_department_id, created_court_id,
             current_stage_id, current_owner_user_id, lifecycle_status,
             created_by_user_id, created_at, updated_at)
        VALUES
            ('وزارة المالية', 'PLAINTIFF', 'شركة الأمل التجارية',
             'DEMO-FRESH-001', 2026, '2026-04-01',
             v_branch_id, v_dept_fi_id, v_court_fi_id,
             NULL, NULL, 'NEW',
             v_section_id, v_now - interval '7 days', v_now - interval '7 days')
        RETURNING id INTO v_case1_id;

        INSERT INTO case_stages
            (litigation_case_id, stage_type, branch_id, department_id, court_id,
             stage_basis_number, stage_year, assigned_lawyer_user_id,
             stage_status, is_read_only, first_hearing_date, first_postponement_reason,
             started_at)
        VALUES
            (v_case1_id, 'FIRST_INSTANCE', v_branch_id, v_dept_fi_id, v_court_fi_id,
             'S-DEMO-001', 2026, NULL,
             'REGISTERED', FALSE, '2026-05-10', 'تبليغ الأطراف',
             v_now - interval '7 days')
        RETURNING id INTO v_stage1_id;

        UPDATE litigation_cases SET current_stage_id = v_stage1_id WHERE id = v_case1_id;

        -- INITIAL hearing entry
        INSERT INTO hearing_progression_entries
            (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
             entered_by_user_id, entry_type, created_at)
        VALUES
            (v_stage1_id, '2026-05-10', 'NOTIFY_PARTIES_PERSONAL', 'تبليغ الأطراف',
             v_section_id, 'INITIAL', v_now - interval '7 days');

        -- Notification: CASE_REGISTERED
        INSERT INTO notifications
            (recipient_user_id, notification_type, title, body,
             related_entity_type, related_entity_id, is_read, created_at)
        VALUES
            (v_section_id, 'CASE_REGISTERED', 'قيد دعوى جديدة',
             'تم قيد دعوى جديدة (DEMO-FRESH-001) — جاهزة لإسناد المحامي.',
             'LITIGATION_CASE', v_case1_id, FALSE, v_now - interval '7 days');

        RAISE NOTICE 'V22: Case 1 (Fresh, assign-ready) created — id=%', v_case1_id;
    END IF;

    -- ==================================================================
    -- 4) CASE 2 — Assigned, rollover/finalize-ready (lifecycle=ACTIVE)
    -- ==================================================================
    IF NOT EXISTS (SELECT 1 FROM litigation_cases WHERE original_basis_number = 'DEMO-ASSIGNED-002') THEN
        INSERT INTO litigation_cases
            (public_entity_name, public_entity_position, opponent_name,
             original_basis_number, basis_year, original_registration_date,
             created_branch_id, created_department_id, created_court_id,
             current_stage_id, current_owner_user_id, lifecycle_status,
             created_by_user_id, created_at, updated_at)
        VALUES
            ('وزارة الصحة', 'DEFENDANT', 'أحمد محمد الخطيب',
             'DEMO-ASSIGNED-002', 2026, '2026-03-15',
             v_branch_id, v_dept_fi_id, v_court_fi_id,
             NULL, v_lawyer1_id, 'ACTIVE',
             v_section_id, v_now - interval '14 days', v_now - interval '5 days')
        RETURNING id INTO v_case2_id;

        INSERT INTO case_stages
            (litigation_case_id, stage_type, branch_id, department_id, court_id,
             stage_basis_number, stage_year, assigned_lawyer_user_id,
             stage_status, is_read_only, first_hearing_date, first_postponement_reason,
             started_at)
        VALUES
            (v_case2_id, 'FIRST_INSTANCE', v_branch_id, v_dept_fi_id, v_court_fi_id,
             'S-DEMO-002', 2026, v_lawyer1_id,
             'IN_PROGRESS', FALSE, '2026-04-01', 'جواب الإدارة',
             v_now - interval '14 days')
        RETURNING id INTO v_stage2_id;

        UPDATE litigation_cases SET current_stage_id = v_stage2_id WHERE id = v_case2_id;

        -- Hearing history: INITIAL + 1 ROLLOVER
        INSERT INTO hearing_progression_entries
            (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
             entered_by_user_id, entry_type, created_at)
        VALUES
            (v_stage2_id, '2026-04-01', 'ENTITY_REPLY', 'جواب الإدارة',
             v_section_id, 'INITIAL', v_now - interval '14 days'),
            (v_stage2_id, '2026-04-20', 'EXPERT_REVIEW', 'كشف وخبرة',
             v_lawyer1_id, 'ROLLOVER', v_now - interval '5 days');

        -- Notifications: CASE_REGISTERED + LAWYER_ASSIGNED
        INSERT INTO notifications
            (recipient_user_id, notification_type, title, body,
             related_entity_type, related_entity_id, is_read, created_at)
        VALUES
            (v_section_id, 'CASE_REGISTERED', 'قيد دعوى جديدة',
             'تم قيد دعوى جديدة (DEMO-ASSIGNED-002).',
             'LITIGATION_CASE', v_case2_id, TRUE, v_now - interval '14 days'),
            (v_lawyer1_id, 'LAWYER_ASSIGNED', 'إسناد دعوى',
             'تم إسناد الدعوى DEMO-ASSIGNED-002 إليك.',
             'LITIGATION_CASE', v_case2_id, FALSE, v_now - interval '10 days');

        -- Reminder: PENDING on this case for the lawyer
        INSERT INTO reminders
            (litigation_case_id, case_stage_id, owner_user_id, reminder_at,
             reminder_text, status, created_at)
        VALUES
            (v_case2_id, v_stage2_id, v_lawyer1_id,
             v_now + interval '3 days',
             'متابعة موعد الجلسة القادمة — كشف وخبرة',
             'PENDING', v_now - interval '2 days');

        -- Reminder: DONE
        INSERT INTO reminders
            (litigation_case_id, case_stage_id, owner_user_id, reminder_at,
             reminder_text, status, created_at)
        VALUES
            (v_case2_id, v_stage2_id, v_lawyer1_id,
             v_now - interval '3 days',
             'مراجعة ملف الدعوى قبل الجلسة',
             'DONE', v_now - interval '10 days');

        RAISE NOTICE 'V22: Case 2 (Assigned, in-progress) created — id=%', v_case2_id;
    END IF;

    -- ==================================================================
    -- 5) CASE 3 — Finalized (resolved register + promote-to-appeal ready)
    -- ==================================================================
    IF NOT EXISTS (SELECT 1 FROM litigation_cases WHERE original_basis_number = 'DEMO-FINAL-003') THEN
        INSERT INTO litigation_cases
            (public_entity_name, public_entity_position, opponent_name,
             original_basis_number, basis_year, original_registration_date,
             created_branch_id, created_department_id, created_court_id,
             current_stage_id, current_owner_user_id, lifecycle_status,
             created_by_user_id, created_at, updated_at)
        VALUES
            ('وزارة التربية', 'PLAINTIFF', 'محمد سعيد العلي',
             'DEMO-FINAL-003', 2025, '2025-11-01',
             v_branch_id, v_dept_fi_id, v_court_fi_id,
             NULL, v_lawyer1_id, 'ACTIVE',
             v_section_id, v_now - interval '150 days', v_now - interval '10 days')
        RETURNING id INTO v_case3_id;

        INSERT INTO case_stages
            (litigation_case_id, stage_type, branch_id, department_id, court_id,
             stage_basis_number, stage_year, assigned_lawyer_user_id,
             stage_status, is_read_only, first_hearing_date, first_postponement_reason,
             started_at, ended_at)
        VALUES
            (v_case3_id, 'FIRST_INSTANCE', v_branch_id, v_dept_fi_id, v_court_fi_id,
             'S-DEMO-003', 2025, v_lawyer1_id,
             'FINALIZED', FALSE, '2025-12-01', 'تبليغ الأطراف',
             v_now - interval '150 days', v_now - interval '10 days')
        RETURNING id INTO v_stage3_id;

        UPDATE litigation_cases SET current_stage_id = v_stage3_id WHERE id = v_case3_id;

        -- Hearing history: INITIAL + ROLLOVER + FINALIZED
        INSERT INTO hearing_progression_entries
            (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
             entered_by_user_id, entry_type, created_at)
        VALUES
            (v_stage3_id, '2025-12-01', 'NOTIFY_PARTIES_PERSONAL', 'تبليغ الأطراف',
             v_section_id, 'INITIAL', v_now - interval '150 days'),
            (v_stage3_id, '2026-01-15', 'OPPONENT_REPLY', 'جواب الخصم',
             v_lawyer1_id, 'ROLLOVER', v_now - interval '90 days'),
            (v_stage3_id, '2026-04-08', NULL, 'فصل — حكم لصالح الجهة',
             v_lawyer1_id, 'FINALIZED', v_now - interval '10 days');

        -- Decision
        INSERT INTO case_decisions
            (case_stage_id, decision_number, decision_date, decision_type,
             adjudged_amount, currency_code, summary_notes,
             finalized_by_user_id, finalized_at)
        VALUES
            (v_stage3_id, 'D-2026-003', '2026-04-08', 'FOR_ENTITY',
             1500000.00, 'SYP', 'حكم لصالح الجهة العامة بتعويض مالي.',
             v_lawyer1_id, v_now - interval '10 days');

        -- Notification: read
        INSERT INTO notifications
            (recipient_user_id, notification_type, title, body,
             related_entity_type, related_entity_id, is_read, created_at, read_at)
        VALUES
            (v_section_id, 'CASE_REGISTERED', 'قيد دعوى جديدة',
             'تم قيد دعوى DEMO-FINAL-003.',
             'LITIGATION_CASE', v_case3_id, TRUE, v_now - interval '150 days', v_now - interval '149 days');

        RAISE NOTICE 'V22: Case 3 (Finalized, appeal-ready) created — id=%', v_case3_id;
    END IF;

    -- ==================================================================
    -- 6) CASE 4 — Full lifecycle: FI finalized → Appeal finalized → Execution-ready
    -- ==================================================================
    IF NOT EXISTS (SELECT 1 FROM litigation_cases WHERE original_basis_number = 'DEMO-EXEC-004') THEN
        INSERT INTO litigation_cases
            (public_entity_name, public_entity_position, opponent_name,
             original_basis_number, basis_year, original_registration_date,
             created_branch_id, created_department_id, created_court_id,
             current_stage_id, current_owner_user_id, lifecycle_status,
             created_by_user_id, created_at, updated_at)
        VALUES
            ('وزارة الدفاع', 'DEFENDANT', 'سامر حسن الشامي',
             'DEMO-EXEC-004', 2025, '2025-06-01',
             v_branch_id, v_dept_fi_id, v_court_fi_id,
             NULL, v_lawyer1_id, 'IN_APPEAL',
             v_section_id, v_now - interval '300 days', v_now - interval '5 days')
        RETURNING id INTO v_case4_id;

        -- Stage 4a: FIRST_INSTANCE — finalized, read-only
        INSERT INTO case_stages
            (litigation_case_id, stage_type, branch_id, department_id, court_id,
             stage_basis_number, stage_year, assigned_lawyer_user_id,
             stage_status, parent_stage_id, is_read_only,
             first_hearing_date, first_postponement_reason,
             started_at, ended_at)
        VALUES
            (v_case4_id, 'FIRST_INSTANCE', v_branch_id, v_dept_fi_id, v_court_fi_id,
             'S-DEMO-004', 2025, v_lawyer1_id,
             'PROMOTED_TO_APPEAL', NULL, TRUE,
             '2025-07-01', 'تبليغ الأطراف',
             v_now - interval '300 days', v_now - interval '200 days')
        RETURNING id INTO v_stage4a_id;

        -- Decision for FI stage
        INSERT INTO case_decisions
            (case_stage_id, decision_number, decision_date, decision_type,
             adjudged_amount, currency_code, summary_notes,
             finalized_by_user_id, finalized_at)
        VALUES
            (v_stage4a_id, 'D-2025-004-FI', '2025-10-15', 'AGAINST_ENTITY',
             500000.00, 'SYP', 'حكم ضد الجهة — استُؤنف.',
             v_lawyer1_id, v_now - interval '200 days');

        -- Hearing history for FI
        INSERT INTO hearing_progression_entries
            (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
             entered_by_user_id, entry_type, created_at)
        VALUES
            (v_stage4a_id, '2025-07-01', 'NOTIFY_PARTIES_PERSONAL', 'تبليغ الأطراف',
             v_section_id, 'INITIAL', v_now - interval '300 days'),
            (v_stage4a_id, '2025-10-15', NULL, 'فصل — حكم ضد الجهة',
             v_lawyer1_id, 'FINALIZED', v_now - interval '200 days');

        -- Stage 4b: APPEAL — finalized (execution-ready)
        INSERT INTO case_stages
            (litigation_case_id, stage_type, branch_id, department_id, court_id,
             stage_basis_number, stage_year, assigned_lawyer_user_id,
             stage_status, parent_stage_id, is_read_only,
             first_hearing_date, first_postponement_reason,
             started_at, ended_at)
        VALUES
            (v_case4_id, 'APPEAL', v_branch_id, v_dept_fi_id, v_court_fi_id,
             'S-DEMO-004-APP', 2026, v_lawyer1_id,
             'FINALIZED', v_stage4a_id, FALSE,
             '2026-01-10', 'تأسيس مرحلة استئناف',
             v_now - interval '100 days', v_now - interval '5 days')
        RETURNING id INTO v_stage4b_id;

        UPDATE litigation_cases SET current_stage_id = v_stage4b_id WHERE id = v_case4_id;

        -- Decision for Appeal stage
        INSERT INTO case_decisions
            (case_stage_id, decision_number, decision_date, decision_type,
             adjudged_amount, currency_code, summary_notes,
             finalized_by_user_id, finalized_at)
        VALUES
            (v_stage4b_id, 'D-2026-004-APP', '2026-04-13', 'FOR_ENTITY',
             750000.00, 'SYP', 'حكم استئنافي لصالح الجهة — قابل للتنفيذ.',
             v_lawyer1_id, v_now - interval '5 days');

        -- Hearing history for Appeal
        INSERT INTO hearing_progression_entries
            (case_stage_id, hearing_date, postponement_reason_code, postponement_reason_label,
             entered_by_user_id, entry_type, created_at)
        VALUES
            (v_stage4b_id, '2026-01-10', 'NOTIFY_PARTIES_FORMAL', 'إخطار الأطراف',
             v_section_id, 'INITIAL', v_now - interval '100 days'),
            (v_stage4b_id, '2026-03-01', 'AUDIT', 'تدقيق',
             v_lawyer1_id, 'ROLLOVER', v_now - interval '50 days'),
            (v_stage4b_id, '2026-04-13', NULL, 'فصل استئنافي — لصالح الجهة',
             v_lawyer1_id, 'FINALIZED', v_now - interval '5 days');

        -- Notifications
        INSERT INTO notifications
            (recipient_user_id, notification_type, title, body,
             related_entity_type, related_entity_id, is_read, created_at, read_at)
        VALUES
            (v_section_id, 'CASE_REGISTERED', 'قيد دعوى جديدة',
             'تم قيد دعوى DEMO-EXEC-004.',
             'LITIGATION_CASE', v_case4_id, TRUE, v_now - interval '300 days', v_now - interval '299 days'),
            (v_lawyer1_id, 'LAWYER_ASSIGNED', 'إسناد دعوى',
             'تم إسناد الدعوى DEMO-EXEC-004 إليك.',
             'LITIGATION_CASE', v_case4_id, TRUE, v_now - interval '290 days', v_now - interval '289 days');

        RAISE NOTICE 'V22: Case 4 (Appeal finalized, execution-ready) created — id=%', v_case4_id;
    END IF;

    -- ==================================================================
    -- 7) EXECUTION FILE for Case 4 + 2 steps
    -- ==================================================================
    IF v_case4_id IS NOT NULL AND v_stage4b_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM execution_files WHERE litigation_case_id = v_case4_id) THEN
            INSERT INTO execution_files
                (litigation_case_id, source_stage_id, enforcing_entity_name,
                 executed_against_name, execution_file_type,
                 execution_file_number, execution_year,
                 branch_id, department_id, assigned_user_id,
                 status, created_by_user_id, created_at, updated_at)
            VALUES
                (v_case4_id, v_stage4b_id, 'وزارة الدفاع',
                 'سامر حسن الشامي', 'حكم مدني',
                 'EX-DEMO-004', 2026,
                 v_branch_id, v_dept_fi_id, v_lawyer1_id,
                 'OPEN', v_section_id, v_now - interval '3 days', v_now - interval '1 day')
            RETURNING id INTO v_exec_file_id;

            -- Execution steps
            INSERT INTO execution_steps
                (execution_file_id, step_date, step_type, step_description,
                 created_by_user_id, created_at)
            VALUES
                (v_exec_file_id, '2026-04-15', 'NOTICE_REQUEST',
                 'طلب تبليغ المحكوم عليه بالحكم التنفيذي.',
                 v_section_id, v_now - interval '3 days'),
                (v_exec_file_id, '2026-04-17', 'NOTICE_ISSUED',
                 'تم تبليغ المحكوم عليه. المهلة القانونية تبدأ.',
                 v_section_id, v_now - interval '1 day');

            -- Update case lifecycle
            UPDATE litigation_cases SET lifecycle_status = 'IN_EXECUTION', updated_at = v_now - interval '3 days'
            WHERE id = v_case4_id;

            -- Mark appeal stage as promoted
            UPDATE case_stages SET stage_status = 'PROMOTED_TO_EXECUTION', is_read_only = TRUE, ended_at = v_now - interval '3 days'
            WHERE id = v_stage4b_id;

            RAISE NOTICE 'V22: Execution file + 2 steps created for Case 4 — exec_id=%', v_exec_file_id;
        END IF;
    END IF;

    -- ==================================================================
    -- 8) ATTACHMENT metadata for Case 2 stage (demo file on disk)
    -- ==================================================================
    IF v_stage2_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM attachments WHERE storage_key = 'demo/stage-' || v_stage2_id || '/demo_file.txt') THEN
            INSERT INTO attachments
                (attachment_scope_type, scope_id, original_filename, content_type,
                 file_size_bytes, storage_key, uploaded_by_user_id, uploaded_at,
                 checksum_sha256, is_active)
            VALUES
                ('CASE_STAGE', v_stage2_id, 'مذكرة_دفاع.txt', 'text/plain',
                 42, 'demo/stage-' || v_stage2_id || '/demo_file.txt',
                 v_lawyer1_id, v_now - interval '4 days',
                 'demo-checksum-placeholder', TRUE);
        END IF;
    END IF;

    -- Execution file attachment
    IF v_exec_file_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM attachments WHERE storage_key = 'demo/exec-' || v_exec_file_id || '/exec_doc.txt') THEN
            INSERT INTO attachments
                (attachment_scope_type, scope_id, original_filename, content_type,
                 file_size_bytes, storage_key, uploaded_by_user_id, uploaded_at,
                 checksum_sha256, is_active)
            VALUES
                ('EXECUTION_FILE', v_exec_file_id, 'صورة_الحكم.txt', 'text/plain',
                 38, 'demo/exec-' || v_exec_file_id || '/exec_doc.txt',
                 v_section_id, v_now - interval '2 days',
                 'demo-exec-checksum-placeholder', TRUE);
        END IF;
    END IF;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'V22 demo seed complete. Password = ChangeMe!2026';
    RAISE NOTICE '============================================';
END $$;

