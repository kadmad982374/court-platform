-- ============================================================
-- V45: Client feedback #3 — demo «تحت الرفع» row (the PDF example).
--
-- Seeds the single illustrative intake row under Damascus / FIRST_INSTANCE
-- so the register isn't empty in the demo. Fully guarded; skips if the
-- (branch, dept) or a seed user is missing, or the row already exists.
--
-- ⚠️  DEMO/DEV ONLY — remove before production. ⚠️
-- ============================================================

DO $$
DECLARE
    v_branch BIGINT;
    v_dept   BIGINT;
    v_user   BIGINT;
    v_now    TIMESTAMPTZ := now();
BEGIN
    SELECT id INTO v_branch FROM branches    WHERE code = 'DAMASCUS';
    SELECT id INTO v_dept   FROM departments WHERE branch_id = v_branch AND type = 'FIRST_INSTANCE';
    SELECT id INTO v_user   FROM users WHERE username = 'section_fi_dam';
    IF v_user IS NULL THEN SELECT id INTO v_user FROM users WHERE username = 'admin'; END IF;
    IF v_user IS NULL THEN SELECT id INTO v_user FROM users ORDER BY id LIMIT 1; END IF;

    IF v_branch IS NULL OR v_dept IS NULL OR v_user IS NULL THEN
        RAISE NOTICE 'V45: pending-submission demo prerequisites missing — skipping';
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM pending_submissions
                WHERE branch_id = v_branch AND incoming_number = '2026/534 و') THEN
        RAISE NOTICE 'V45: pending-submission demo row already present — skipping';
        RETURN;
    END IF;

    INSERT INTO pending_submissions (
        branch_id, department_id, incoming_number, letter_number,
        public_entity_name, opponent_name, subject, notes,
        created_by_user_id, created_at, updated_at, version)
    VALUES (
        v_branch, v_dept, '2026/534 و', '1342/ص',
        'السورية للاتصالات', 'سمير بدور', 'ترك عمل', 'تحت رفع صلح',
        v_user, v_now, v_now, 0);
    RAISE NOTICE 'V45: seeded pending-submission demo row';
END $$;
