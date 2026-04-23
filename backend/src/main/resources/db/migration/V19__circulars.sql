-- V19: circulars (Phase 7)
--
-- Read-oriented circulars / decisions from MoJ and the State Litigation
-- Administration. No publishing workflow. D-040.

CREATE TABLE circulars (
    id                BIGSERIAL PRIMARY KEY,
    source_type       VARCHAR(64)  NOT NULL,
    title             VARCHAR(300) NOT NULL,
    summary           VARCHAR(2000),
    body_text         TEXT         NOT NULL,
    issue_date        DATE         NOT NULL,
    reference_number  VARCHAR(64),
    keywords          VARCHAR(1000),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL,
    updated_at        TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_circ_source_type CHECK (source_type IN
        ('MINISTRY_OF_JUSTICE','STATE_LITIGATION_ADMINISTRATION'))
);

CREATE INDEX ix_circ_source       ON circulars(source_type);
CREATE INDEX ix_circ_issue_date   ON circulars(issue_date);
CREATE INDEX ix_circ_active       ON circulars(is_active);
CREATE INDEX ix_circ_title_lower  ON circulars(LOWER(title));

-- ----- Seed -----
INSERT INTO circulars
    (source_type, title, summary, body_text, issue_date, reference_number, keywords, is_active, created_at, updated_at)
VALUES
    ('MINISTRY_OF_JUSTICE',
     'تعميم وزارة العدل بشأن مواعيد الجلسات',
     'تنظيم مواعيد جلسات المحاكم وضرورة الالتزام بالمواعيد المقررة.',
     'يطلب التعميم من جميع المحاكم الالتزام بالمواعيد المقررة للجلسات وعدم تأجيلها إلا للضرورة.',
     DATE '2024-03-01', 'MOJ-2024-001',
     'جلسات,مواعيد,محاكم', TRUE, NOW(), NOW()),

    ('MINISTRY_OF_JUSTICE',
     'تعميم وزارة العدل بشأن الأرشفة الإلكترونية',
     'تطبيق الأرشفة الإلكترونية في كتّاب العدل.',
     'يلزم التعميم كتّاب العدل بالبدء بالأرشفة الإلكترونية للملفات وفق المعايير المحددة.',
     DATE '2024-06-15', 'MOJ-2024-014',
     'أرشفة,كتاب عدل,رقمنة', TRUE, NOW(), NOW()),

    ('STATE_LITIGATION_ADMINISTRATION',
     'تعميم إدارة قضايا الدولة بشأن متابعة الدعاوى',
     'إجراءات متابعة الدعاوى المرفوعة من وعلى الدولة.',
     'يحدد التعميم الإجراءات الواجبة على المحامين في متابعة الدعاوى وضرورة رفع تقارير دورية.',
     DATE '2025-01-10', 'SLA-2025-001',
     'متابعة دعاوى,تقارير دورية', TRUE, NOW(), NOW()),

    ('STATE_LITIGATION_ADMINISTRATION',
     'تعميم إدارة قضايا الدولة بشأن التسويات',
     'الضوابط العامة لقبول التسويات الودية.',
     'يحدد التعميم الحالات التي يجوز فيها قبول التسويات الودية والشروط الواجبة لذلك.',
     DATE '2025-04-05', 'SLA-2025-007',
     'تسويات,صلح', TRUE, NOW(), NOW());

