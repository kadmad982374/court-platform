-- V18: public_entity_directory (Phase 7)
--
-- Read-oriented directory of public entities (ministries, agencies, etc.)
-- and their categories. No master-data workflow in Phase 7. D-040.

CREATE TABLE public_entity_categories (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL,
    name_ar     VARCHAR(200) NOT NULL,
    parent_id   BIGINT          REFERENCES public_entity_categories(id),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT uq_pe_cat_code UNIQUE (code)
);

CREATE INDEX ix_pe_cat_parent ON public_entity_categories(parent_id);
CREATE INDEX ix_pe_cat_active ON public_entity_categories(is_active);

CREATE TABLE public_entity_items (
    id                 BIGSERIAL PRIMARY KEY,
    category_id        BIGINT       NOT NULL REFERENCES public_entity_categories(id),
    name_ar            VARCHAR(300) NOT NULL,
    short_description  VARCHAR(500),
    details_text       TEXT,
    keywords           VARCHAR(1000),
    reference_code     VARCHAR(64),
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uq_pe_item_ref UNIQUE (reference_code)
);

CREATE INDEX ix_pe_item_category ON public_entity_items(category_id);
CREATE INDEX ix_pe_item_active   ON public_entity_items(is_active);
CREATE INDEX ix_pe_item_name_lower ON public_entity_items(LOWER(name_ar));

-- ----- Seed -----
INSERT INTO public_entity_categories (code, name_ar, parent_id, is_active, sort_order) VALUES
    ('MINISTRIES',       'الوزارات',           NULL, TRUE, 10),
    ('OTHER_AUTHORITIES','جهات عامة أخرى',     NULL, TRUE, 20);

INSERT INTO public_entity_items
    (category_id, name_ar, short_description, details_text, keywords, reference_code, is_active, created_at, updated_at)
VALUES
    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة الدفاع', 'الوزارة المسؤولة عن الشؤون الدفاعية.',
     'تختص بالشؤون العسكرية والدفاع الوطني.', 'دفاع,عسكرية', 'MOD',  TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة الداخلية', 'الوزارة المسؤولة عن الأمن الداخلي.',
     'تختص بالأمن الداخلي والأحوال المدنية والشرطة.', 'داخلية,أمن', 'MOI',  TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة العدل', 'الوزارة المسؤولة عن الشؤون القضائية والإدارية للعدالة.',
     'تختص بإدارة المحاكم والكتّاب بالعدل والسجل العدلي والتشريع.', 'عدل,قضاء', 'MOJ',  TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة الصحة', 'الوزارة المسؤولة عن قطاع الصحة العامة.',
     'تختص بالسياسات الصحية والمستشفيات الحكومية.', 'صحة,مستشفيات', 'MOH', TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة المالية', 'الوزارة المسؤولة عن المالية العامة.',
     'تختص بالموازنة العامة والضرائب والجمارك.', 'مالية,ضرائب,جمارك', 'MOF', TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة الخارجية والمغتربين', 'الوزارة المسؤولة عن الشؤون الخارجية.',
     'تختص بالعلاقات الدبلوماسية وشؤون المغتربين.', 'خارجية,دبلوماسية', 'MOFA', TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة التربية', 'الوزارة المسؤولة عن التعليم العام.',
     'تختص بالمناهج والمدارس الحكومية والتعليم الأساسي والثانوي.', 'تربية,تعليم', 'MOE', TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة التعليم العالي والبحث العلمي', 'الوزارة المسؤولة عن التعليم العالي.',
     'تختص بالجامعات الحكومية والمعاهد العليا والبحث العلمي.', 'تعليم عالي,جامعات', 'MOHE', TRUE, NOW(), NOW()),

    ((SELECT id FROM public_entity_categories WHERE code='MINISTRIES'),
     'وزارة الإدارة المحلية والبيئة', 'الوزارة المسؤولة عن الإدارة المحلية.',
     'تختص بالمحافظات والمجالس المحلية والبلديات والشؤون البيئية.', 'إدارة محلية,بلديات,بيئة', 'MOLA', TRUE, NOW(), NOW());

