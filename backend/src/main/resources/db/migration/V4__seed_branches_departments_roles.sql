-- V4: Seed branches, departments, roles (Phase 1)

INSERT INTO branches (code, name_ar, province_name, is_active) VALUES
 ('DAMASCUS',         'دمشق',        'دمشق',        TRUE),
 ('RURAL_DAMASCUS',   'ريف دمشق',    'ريف دمشق',    TRUE),
 ('DARAA',            'درعا',        'درعا',        TRUE),
 ('SUWAYDA',          'السويداء',    'السويداء',    TRUE),
 ('QUNEITRA',         'القنيطرة',    'القنيطرة',    TRUE),
 ('HOMS',             'حمص',         'حمص',         TRUE),
 ('HAMA',             'حماة',        'حماة',        TRUE),
 ('ALEPPO',           'حلب',         'حلب',         TRUE),
 ('IDLIB',            'إدلب',        'إدلب',        TRUE),
 ('LATAKIA',          'اللاذقية',    'اللاذقية',    TRUE),
 ('TARTUS',           'طرطوس',       'طرطوس',       TRUE),
 ('HASAKAH',          'الحسكة',      'الحسكة',      TRUE),
 ('RAQQA',            'الرقة',       'الرقة',       TRUE),
 ('DEIR_EZ_ZOR',      'دير الزور',   'دير الزور',   TRUE);

-- Four departments for every branch.
INSERT INTO departments (branch_id, type, name_ar, is_active)
SELECT b.id, t.type, t.name_ar, TRUE
FROM branches b
CROSS JOIN (VALUES
    ('CONCILIATION',   'قسم الصلح'),
    ('FIRST_INSTANCE', 'قسم البداية'),
    ('APPEAL',         'قسم الاستئناف'),
    ('EXECUTION',      'قسم التنفيذ')
) AS t(type, name_ar);

-- Roles
INSERT INTO roles (type, name_ar) VALUES
 ('CENTRAL_SUPERVISOR',   'مشرف مركزي'),
 ('BRANCH_HEAD',          'رئيس فرع'),
 ('SECTION_HEAD',         'رئيس قسم'),
 ('ADMIN_CLERK',          'موظف إداري'),
 ('STATE_LAWYER',         'محامي دولة'),
 ('READ_ONLY_SUPERVISOR', 'مشرف اطلاع'),
 ('SPECIAL_INSPECTOR',    'مفتش خاص');

