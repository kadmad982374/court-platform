-- V28: Customer feedback round-2 — execution circles (دوائر التنفيذ).
--
-- Why: in the Execution tab the "court" dropdown was showing the four stage
-- courts of the branch (محكمة الصلح / البداية / الاستئناف / دائرة التنفيذ).
-- The customer requires execution to be browsed by EXECUTION CIRCLE
-- (دائرة تنفيذ) instead — typically 3-4 circles per governorate, named after
-- the local towns/districts.
--
-- Strategy:
--   1) Deactivate the single placeholder "دائرة التنفيذ - {branch}" that V5
--      seeded so it no longer appears in pickers. We deactivate (not delete)
--      so any pre-existing case-stage row that pointed at it still resolves.
--   2) Insert example circle rows per branch. Names per the customer's
--      explicit examples for Damascus / Latakia / Raqqa, and reasonable
--      example district names for the other 11 governorates ("examples only,
--      real names will be added at project approval" — customer's wording).

-- 1) Hide the V5 placeholder execution court.
UPDATE courts
   SET is_active = FALSE
 WHERE department_type = 'EXECUTION'
   AND name_ar LIKE 'دائرة التنفيذ - %';

-- 2) Insert example execution circles. (branch_code, circle name) pairs.
INSERT INTO courts (branch_id, department_type, name_ar, chamber_support, is_active)
SELECT b.id, 'EXECUTION', cn.name_ar, FALSE, TRUE
FROM branches b
JOIN (VALUES
    -- ── دمشق (per customer example) ──
    ('DAMASCUS',         'دائرة تنفيذ دمشق'),
    ('DAMASCUS',         'دائرة تنفيذ ريف دمشق'),
    ('DAMASCUS',         'دائرة تنفيذ التل'),
    ('DAMASCUS',         'دائرة تنفيذ قطنا'),

    -- ── ريف دمشق ──
    ('RURAL_DAMASCUS',   'دائرة تنفيذ دوما'),
    ('RURAL_DAMASCUS',   'دائرة تنفيذ الزبداني'),
    ('RURAL_DAMASCUS',   'دائرة تنفيذ يبرود'),
    ('RURAL_DAMASCUS',   'دائرة تنفيذ النبك'),

    -- ── درعا ──
    ('DARAA',            'دائرة تنفيذ درعا'),
    ('DARAA',            'دائرة تنفيذ إزرع'),
    ('DARAA',            'دائرة تنفيذ نوى'),
    ('DARAA',            'دائرة تنفيذ الصنمين'),

    -- ── السويداء ──
    ('SUWAYDA',          'دائرة تنفيذ السويداء'),
    ('SUWAYDA',          'دائرة تنفيذ صلخد'),
    ('SUWAYDA',          'دائرة تنفيذ شهبا'),
    ('SUWAYDA',          'دائرة تنفيذ القريا'),

    -- ── القنيطرة ──
    ('QUNEITRA',         'دائرة تنفيذ القنيطرة'),
    ('QUNEITRA',         'دائرة تنفيذ البعث'),
    ('QUNEITRA',         'دائرة تنفيذ خان أرنبة'),
    ('QUNEITRA',         'دائرة تنفيذ فيق'),

    -- ── حمص ──
    ('HOMS',             'دائرة تنفيذ حمص'),
    ('HOMS',             'دائرة تنفيذ الرستن'),
    ('HOMS',             'دائرة تنفيذ تدمر'),
    ('HOMS',             'دائرة تنفيذ تلكلخ'),

    -- ── حماة ──
    ('HAMA',             'دائرة تنفيذ حماة'),
    ('HAMA',             'دائرة تنفيذ السلمية'),
    ('HAMA',             'دائرة تنفيذ مصياف'),
    ('HAMA',             'دائرة تنفيذ محردة'),

    -- ── حلب ──
    ('ALEPPO',           'دائرة تنفيذ حلب'),
    ('ALEPPO',           'دائرة تنفيذ عفرين'),
    ('ALEPPO',           'دائرة تنفيذ منبج'),
    ('ALEPPO',           'دائرة تنفيذ الباب'),

    -- ── إدلب ──
    ('IDLIB',            'دائرة تنفيذ إدلب'),
    ('IDLIB',            'دائرة تنفيذ معرة النعمان'),
    ('IDLIB',            'دائرة تنفيذ أريحا'),
    ('IDLIB',            'دائرة تنفيذ جسر الشغور'),

    -- ── اللاذقية (per customer example) ──
    ('LATAKIA',          'دائرة تنفيذ اللاذقية'),
    ('LATAKIA',          'دائرة تنفيذ جبلة'),
    ('LATAKIA',          'دائرة تنفيذ الحفة'),
    ('LATAKIA',          'دائرة تنفيذ القرداحة'),

    -- ── طرطوس ──
    ('TARTUS',           'دائرة تنفيذ طرطوس'),
    ('TARTUS',           'دائرة تنفيذ صافيتا'),
    ('TARTUS',           'دائرة تنفيذ بانياس'),
    ('TARTUS',           'دائرة تنفيذ الشيخ بدر'),

    -- ── الحسكة ──
    ('HASAKAH',          'دائرة تنفيذ الحسكة'),
    ('HASAKAH',          'دائرة تنفيذ القامشلي'),
    ('HASAKAH',          'دائرة تنفيذ رأس العين'),
    ('HASAKAH',          'دائرة تنفيذ المالكية'),

    -- ── الرقة (per customer example — three circles, per their list) ──
    ('RAQQA',            'دائرة تنفيذ الرقة'),
    ('RAQQA',            'دائرة تنفيذ تل أبيض'),
    ('RAQQA',            'دائرة تنفيذ الطبقة'),

    -- ── دير الزور ──
    ('DEIR_EZ_ZOR',      'دائرة تنفيذ دير الزور'),
    ('DEIR_EZ_ZOR',      'دائرة تنفيذ البوكمال'),
    ('DEIR_EZ_ZOR',      'دائرة تنفيذ الميادين'),
    ('DEIR_EZ_ZOR',      'دائرة تنفيذ الموحسن')
) AS cn(branch_code, name_ar)
  ON cn.branch_code = b.code;
