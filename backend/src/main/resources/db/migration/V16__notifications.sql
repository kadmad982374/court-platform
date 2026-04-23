-- V16: notifications (Phase 6)
--
-- إشعارات داخلية بسيطة. لا قنوات خارجية في Phase 6 (D-013/D-010).
-- recipient_user_id حصري؛ القراءة/التحديث على ما يخص المستخدم الحالي فقط.

CREATE TABLE notifications (
    id                    BIGSERIAL PRIMARY KEY,
    recipient_user_id     BIGINT       NOT NULL REFERENCES users(id),
    notification_type     VARCHAR(64)  NOT NULL,
    title                 VARCHAR(200) NOT NULL,
    body                  VARCHAR(2000) NOT NULL,
    related_entity_type   VARCHAR(64),
    related_entity_id     BIGINT,
    is_read               BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ  NOT NULL,
    read_at               TIMESTAMPTZ
);

CREATE INDEX ix_notif_recipient_unread ON notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX ix_notif_recipient        ON notifications(recipient_user_id, created_at DESC);

