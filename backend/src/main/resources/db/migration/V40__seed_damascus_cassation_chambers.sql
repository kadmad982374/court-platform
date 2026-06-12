-- ============================================================
-- V40: Client feedback — cassation chambers (غرف النقض) as courts, DAMASCUS.
--
-- The «المحكمة» dropdown for قسم النقض shows these chambers. They are seeded
-- as courts rows under department_type = 'CASSATION' with chamber_support.
-- Per the client PDF list. Idempotent via NOT EXISTS on (branch, type, name).
-- ============================================================

INSERT INTO courts (branch_id, department_type, name_ar, chamber_support, is_active)
SELECT b.id, 'CASSATION', c.name_ar, TRUE, TRUE
FROM branches b
CROSS JOIN (VALUES
    ('الغرفة المدنية الأولى'),
    ('الغرفة المدنية الثانية'),
    ('الغرفة المدنية الثالثة'),
    ('الغرفة الجزائية الأولى'),
    ('الغرفة الجزائية الثانية'),
    ('الغرفة الجنائية'),
    ('غرفة الإحالة'),
    ('غرفة الأحداث'),
    ('الغرفة الجنحية الأولى')
) AS c(name_ar)
WHERE b.code = 'DAMASCUS'
  AND NOT EXISTS (
      SELECT 1 FROM courts ct
       WHERE ct.branch_id = b.id
         AND ct.department_type = 'CASSATION'
         AND ct.name_ar = c.name_ar
  );
