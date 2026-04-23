package sy.gov.sla.notifications;

import org.junit.jupiter.api.Test;
import sy.gov.sla.notifications.domain.Notification;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Notification model: حقل id قابل للتغيير عبر JPA فقط (no setId test)؛
 * وجود setters للحقول الإدارية (read/readAt) ضروري لخدمة markRead.
 */
class NotificationModelUnitTest {

    @Test
    void hasReadAndReadAtSetters() {
        List<String> setters = Arrays.stream(Notification.class.getMethods())
                .map(Method::getName).filter(n -> n.startsWith("set")).toList();
        assertThat(setters).contains("setRead", "setReadAt");
    }

    @Test
    void canBuildViaBuilder() {
        Notification n = Notification.builder()
                .recipientUserId(1L).notificationType("X").title("t").body("b")
                .read(false).createdAt(Instant.now()).build();
        assertThat(n.getNotificationType()).isEqualTo("X");
        assertThat(n.isRead()).isFalse();
    }
}

