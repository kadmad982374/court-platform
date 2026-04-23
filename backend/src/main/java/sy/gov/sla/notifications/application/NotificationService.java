package sy.gov.sla.notifications.application;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.notifications.api.NotificationDto;
import sy.gov.sla.notifications.domain.Notification;
import sy.gov.sla.notifications.infrastructure.NotificationRepository;

import java.time.Instant;
import java.util.List;

/**
 * إدارة قراءة الإشعارات وعلامة القراءة. Phase 6.
 *
 * الإنشاء يحدث **فقط** عبر مستهلكي الأحداث في {@code notifications.application.listeners}
 * — لا API لإنشاء إشعار يدوي (D-038).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository repo;

    @Transactional(readOnly = true)
    public List<NotificationDto> listMine(Long actorUserId, int page, int size) {
        if (size <= 0) size = 20;
        if (size > 100) size = 100;
        if (page < 0) page = 0;
        Pageable pageable = PageRequest.of(page, size);
        return repo.findByRecipientUserIdOrderByCreatedAtDesc(actorUserId, pageable)
                .getContent().stream().map(this::toDto).toList();
    }

    public NotificationDto markRead(Long id, Long actorUserId) {
        Notification n = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Notification not found: " + id));
        if (!n.getRecipientUserId().equals(actorUserId)) {
            throw new ForbiddenException("Notification does not belong to current user");
        }
        if (!n.isRead()) {
            n.setRead(true);
            n.setReadAt(Instant.now());
        }
        return toDto(n);
    }

    /** API داخلية يستخدمها مستهلكو الأحداث فقط. */
    public Notification createInternal(Long recipientUserId, String type, String title, String body,
                                       String relatedEntityType, Long relatedEntityId) {
        Notification n = Notification.builder()
                .recipientUserId(recipientUserId)
                .notificationType(type)
                .title(title)
                .body(body)
                .relatedEntityType(relatedEntityType)
                .relatedEntityId(relatedEntityId)
                .read(false)
                .createdAt(Instant.now())
                .build();
        return repo.save(n);
    }

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(n.getId(), n.getRecipientUserId(), n.getNotificationType(),
                n.getTitle(), n.getBody(), n.getRelatedEntityType(), n.getRelatedEntityId(),
                n.isRead(), n.getCreatedAt(), n.getReadAt());
    }
}

