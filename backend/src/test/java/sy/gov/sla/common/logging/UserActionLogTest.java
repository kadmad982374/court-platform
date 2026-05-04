package sy.gov.sla.common.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies UserActionLog formatting + MDC consumption (`who()` helper).
 * Captures logs on the dedicated "sy.gov.sla.USER_ACTION" channel via a Logback
 * ListAppender so we can assert on level + formatted message.
 */
class UserActionLogTest {

    private Logger backend;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void attachAppender() {
        backend = (Logger) LoggerFactory.getLogger("sy.gov.sla.USER_ACTION");
        appender = new ListAppender<>();
        appender.start();
        backend.addAppender(appender);
        MDC.clear();
    }

    @AfterEach
    void detach() {
        backend.detachAppender(appender);
        MDC.clear();
    }

    @Test
    void action_with_username_in_MDC_uses_role_when_present() {
        MDC.put("username", "section_fi_dam");
        MDC.put("role", "SECTION_HEAD");

        UserActionLog.action("created case #{} — court={}", 42, "Damascus");

        assertThat(appender.list).hasSize(1);
        ILoggingEvent ev = appender.list.get(0);
        assertThat(ev.getLevel()).isEqualTo(Level.INFO);
        assertThat(ev.getFormattedMessage())
                .isEqualTo("[ACTION] User 'section_fi_dam' (SECTION_HEAD) created case #42 — court=Damascus");
    }

    @Test
    void action_without_role_falls_back_to_unrolled_user() {
        MDC.put("username", "alice");

        UserActionLog.action("did a thing");

        assertThat(appender.list.get(0).getFormattedMessage())
                .isEqualTo("[ACTION] User 'alice' did a thing");
    }

    @Test
    void action_with_no_username_in_MDC_marks_as_anonymous() {
        UserActionLog.action("logged in");

        assertThat(appender.list.get(0).getFormattedMessage())
                .isEqualTo("[ACTION] Anonymous — logged in");
    }

    @Test
    void blank_username_treated_as_anonymous() {
        MDC.put("username", "  ");

        UserActionLog.action("ping");

        assertThat(appender.list.get(0).getFormattedMessage())
                .isEqualTo("[ACTION] Anonymous — ping");
    }

    @Test
    void denied_logs_at_WARN_with_DENIED_tag() {
        MDC.put("username", "lawyer_b");
        MDC.put("role", "STATE_LAWYER");

        UserActionLog.denied("tried to read case #{} — not the assigned lawyer", 99);

        ILoggingEvent ev = appender.list.get(0);
        assertThat(ev.getLevel()).isEqualTo(Level.WARN);
        assertThat(ev.getFormattedMessage())
                .isEqualTo("[DENIED] User 'lawyer_b' (STATE_LAWYER) tried to read case #99 — not the assigned lawyer");
    }

    @Test
    void system_does_NOT_consume_MDC() {
        MDC.put("username", "alice");

        UserActionLog.system("Bootstrap admin created");

        assertThat(appender.list.get(0).getFormattedMessage())
                .isEqualTo("[SYSTEM] Bootstrap admin created");
    }

    @Test
    void failed_logs_at_INFO_with_FAILED_tag() {
        UserActionLog.failed("validation failed: {}", "missing username");

        ILoggingEvent ev = appender.list.get(0);
        assertThat(ev.getLevel()).isEqualTo(Level.INFO);
        assertThat(ev.getFormattedMessage())
                .isEqualTo("[FAILED] Anonymous — validation failed: missing username");
    }

    @Test
    void zero_args_pattern_is_emitted_verbatim() {
        UserActionLog.system("nothing-to-format");

        assertThat(appender.list.get(0).getFormattedMessage())
                .isEqualTo("[SYSTEM] nothing-to-format");
    }
}
