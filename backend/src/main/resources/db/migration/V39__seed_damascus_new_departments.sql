-- ============================================================
-- V39: Client feedback — seed the three new sections for DAMASCUS only.
--
-- Unlike the original 4 department types (seeded across all 14 branches in
-- V4), these are Damascus-exclusive. The NOT EXISTS guard + the
-- uk_departments_branch_type unique key make this idempotent.
-- ============================================================

INSERT INTO departments (branch_id, type, name_ar, is_active)
SELECT b.id, t.type, t.name_ar, TRUE
FROM branches b
CROSS JOIN (VALUES
    ('CASSATION',                'قسم النقض'),
    ('ADMINISTRATIVE_JUDICIARY', 'القضاء الإداري'),
    ('EXTERNAL_DISPUTES',        'المنازعات الخارجية')
) AS t(type, name_ar)
WHERE b.code = 'DAMASCUS'
  AND NOT EXISTS (
      SELECT 1 FROM departments d
       WHERE d.branch_id = b.id AND d.type = t.type
  );
