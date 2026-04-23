-- V17: legal_library (Phase 7)
--
-- Read-oriented reference data: legal categories (hierarchical) + library items
-- (legal texts, jurisprudence, decrees and laws). No CMS workflow in Phase 7.
-- D-040 (legal library shape).

CREATE TABLE legal_categories (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL,
    name_ar     VARCHAR(200) NOT NULL,
    parent_id   BIGINT          REFERENCES legal_categories(id),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT uq_legal_cat_code UNIQUE (code)
);

CREATE INDEX ix_legal_cat_parent ON legal_categories(parent_id);
CREATE INDEX ix_legal_cat_active ON legal_categories(is_active);

CREATE TABLE legal_library_items (
    id                BIGSERIAL PRIMARY KEY,
    category_id       BIGINT       NOT NULL REFERENCES legal_categories(id),
    title             VARCHAR(300) NOT NULL,
    summary           VARCHAR(2000),
    body_text         TEXT         NOT NULL,
    keywords          VARCHAR(1000),
    source_reference  VARCHAR(300),
    published_at      DATE,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL,
    updated_at        TIMESTAMPTZ  NOT NULL
);

CREATE INDEX ix_legal_item_category ON legal_library_items(category_id);
CREATE INDEX ix_legal_item_active   ON legal_library_items(is_active);
CREATE INDEX ix_legal_item_published ON legal_library_items(published_at);
-- Simple text search assist (case-insensitive ILIKE on title); kept small
-- and conservative — no tsvector / no GIN in Phase 7 (D-041).
CREATE INDEX ix_legal_item_title_lower ON legal_library_items(LOWER(title));

-- ----- Seed: categories (Phase 7) -----
INSERT INTO legal_categories (code, name_ar, parent_id, is_active, sort_order) VALUES
    ('CIVIL_LAW',           'القانون المدني',                 NULL, TRUE,  10),
    ('PENAL_LAW',           'القانون الجزائي',                NULL, TRUE,  20),
    ('PROCEDURE_LAW',       'أصول المحاكمات',                  NULL, TRUE,  30),
    ('EVIDENCE_LAW',        'قانون البينات',                   NULL, TRUE,  40),
    ('ADMINISTRATIVE_LAW',  'القانون الإداري',                 NULL, TRUE,  50),
    ('CASSATION_RULINGS',   'اجتهادات محكمة النقض',           NULL, TRUE,  60),
    ('DECREES_AND_LAWS',    'مراسيم وقوانين',                  NULL, TRUE,  70);

-- ----- Seed: 1-2 items per category -----
INSERT INTO legal_library_items
    (category_id, title, summary, body_text, keywords, source_reference, published_at, is_active, created_at, updated_at)
VALUES
    ((SELECT id FROM legal_categories WHERE code='CIVIL_LAW'),
     'القانون المدني السوري — أحكام عامة',
     'مدخل عام لأحكام القانون المدني وتعريف الالتزامات.',
     'تتضمن هذه المادة المرجعية مدخلًا عامًا لأحكام القانون المدني السوري وتعريف الالتزامات والعقود.',
     'مدني,التزامات,عقود',
     'القانون المدني السوري', DATE '1949-05-18', TRUE, NOW(), NOW()),

    ((SELECT id FROM legal_categories WHERE code='PENAL_LAW'),
     'قانون العقوبات العام',
     'الأركان العامة للجرائم والعقوبات.',
     'يعرض هذا النص الأركان المادية والمعنوية للجرائم والعقوبات وفق قانون العقوبات.',
     'جزاء,عقوبات,جرائم',
     'قانون العقوبات', DATE '1949-06-22', TRUE, NOW(), NOW()),

    ((SELECT id FROM legal_categories WHERE code='PROCEDURE_LAW'),
     'قانون أصول المحاكمات المدنية',
     'إجراءات التقاضي المدني.',
     'يتناول هذا النص إجراءات التقاضي المدني من رفع الدعوى وحتى صدور الحكم.',
     'أصول,محاكمات,مدني',
     'قانون أصول المحاكمات المدنية', DATE '2016-09-26', TRUE, NOW(), NOW()),

    ((SELECT id FROM legal_categories WHERE code='EVIDENCE_LAW'),
     'قانون البينات',
     'وسائل الإثبات في المسائل المدنية والتجارية.',
     'يعدد قانون البينات وسائل الإثبات المعتمدة كالكتابة والشهادة والقرائن واليمين.',
     'بينات,إثبات,قرائن',
     'قانون البينات', DATE '1947-03-10', TRUE, NOW(), NOW()),

    ((SELECT id FROM legal_categories WHERE code='ADMINISTRATIVE_LAW'),
     'مبادئ القانون الإداري',
     'تعريف القرار الإداري وأركانه.',
     'يستعرض هذا المقال القرار الإداري وأركانه وأوجه الطعن فيه أمام القضاء الإداري.',
     'إداري,قرار إداري,طعن',
     'مرجع أكاديمي', DATE '2010-01-01', TRUE, NOW(), NOW()),

    ((SELECT id FROM legal_categories WHERE code='CASSATION_RULINGS'),
     'اجتهاد محكمة النقض في الإثبات',
     'تطبيق قواعد البينات في الاجتهاد.',
     'يلخص هذا الاجتهاد موقف محكمة النقض من تطبيق قواعد قانون البينات في الدعاوى المدنية.',
     'نقض,اجتهاد,بينات',
     'قرار محكمة النقض رقم 1/2015', DATE '2015-02-15', TRUE, NOW(), NOW()),

    ((SELECT id FROM legal_categories WHERE code='DECREES_AND_LAWS'),
     'المرسوم التشريعي رقم 55 لعام 2003',
     'تنظيم إدارة قضايا الدولة.',
     'يحدد هذا المرسوم تنظيم إدارة قضايا الدولة ومهامها واختصاصاتها.',
     'مرسوم,إدارة قضايا الدولة,تنظيم',
     'المرسوم التشريعي 55/2003', DATE '2003-08-01', TRUE, NOW(), NOW());

