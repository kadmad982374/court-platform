-- V8: postponement_reasons reference table + seed (Phase 3, D-008/D-022)

CREATE TABLE postponement_reasons (
    code      VARCHAR(64)  PRIMARY KEY,
    label_ar  VARCHAR(200) NOT NULL,
    is_active BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO postponement_reasons (code, label_ar, is_active) VALUES
 ('NOTIFY_PARTIES_PERSONAL', 'تبليغ الأطراف',       TRUE),
 ('NOTIFY_PARTIES_FORMAL',   'إخطار الأطراف',       TRUE),
 ('EXPERT_REVIEW',           'كشف وخبرة',           TRUE),
 ('ENTITY_REPLY',            'جواب الإدارة',        TRUE),
 ('OPPONENT_REPLY',          'جواب الخصم',          TRUE),
 ('AUDIT',                   'تدقيق',               TRUE),
 ('NOTIFY_BY_PRESS',         'تبليغ بالصحف',        TRUE),
 ('NOTIFICATION_BY_PRESS',   'إخطار بالصحف',        TRUE);

