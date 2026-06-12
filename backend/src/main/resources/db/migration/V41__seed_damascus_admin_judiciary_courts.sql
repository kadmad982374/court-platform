-- ============================================================
-- V41: Client feedback — administrative-judiciary courts (DAMASCUS).
--
-- The «المحكمة» dropdown for القضاء الإداري shows these two courts.
-- ============================================================

INSERT INTO courts (branch_id, department_type, name_ar, chamber_support, is_active)
SELECT b.id, 'ADMINISTRATIVE_JUDICIARY', c.name_ar, FALSE, TRUE
FROM branches b
CROSS JOIN (VALUES
    ('محكمة القضاء الإداري'),
    ('المحكمة الإدارية العليا')
) AS c(name_ar)
WHERE b.code = 'DAMASCUS'
  AND NOT EXISTS (
      SELECT 1 FROM courts ct
       WHERE ct.branch_id = b.id
         AND ct.department_type = 'ADMINISTRATIVE_JUDICIARY'
         AND ct.name_ar = c.name_ar
  );
