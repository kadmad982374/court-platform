package sy.gov.sla.common.logging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

/**
 * Human-readable activity log for user-initiated actions.
 * One line per action, meant to be tailed during test sessions so an observer
 * can narrate what the user is doing.
 *
 * Format: [TAG] User 'username' (ROLE) <verb> <target> — <details>
 * Examples:
 *   [ACTION] User 'section_fi_dam' (SECTION_HEAD) created case #42 — court=Damascus, basis=123/2026
 *   [ACTION] User 'lawyer_fi_dam' (STATE_LAWYER) rolled over stage #7 of case #42 — next=2026-05-01
 *   [DENIED] User 'lawyer_b' (STATE_LAWYER) tried to read case #99 — not the assigned lawyer
 *   [SYSTEM] Anonymous login failed — reason=INVALID_CREDENTIALS, username=admin
 *
 * Uses a dedicated logger name ("sy.gov.sla.USER_ACTION") so it can be routed
 * or filtered independently in logback config if needed.
 */
public final class UserActionLog {

    private static final Logger LOG = LoggerFactory.getLogger("sy.gov.sla.USER_ACTION");

    private UserActionLog() {}

    /** A user-initiated action that succeeded. INFO level. */
    public static void action(String pattern, Object... args) {
        LOG.info("[ACTION] {}{}", who(), format(pattern, args));
    }

    /** A user-initiated action that was rejected by authorization. WARN level. */
    public static void denied(String pattern, Object... args) {
        LOG.warn("[DENIED] {}{}", who(), format(pattern, args));
    }

    /** A system-level event not tied to a user request (bootstrap, scheduled, etc.). INFO. */
    public static void system(String pattern, Object... args) {
        LOG.info("[SYSTEM] {}", format(pattern, args));
    }

    /** A validation / business rule failure visible to the user. INFO. */
    public static void failed(String pattern, Object... args) {
        LOG.info("[FAILED] {}{}", who(), format(pattern, args));
    }

    private static String who() {
        String username = MDC.get("username");
        if (username == null || username.isBlank()) {
            return "Anonymous — ";
        }
        String role = MDC.get("role");
        if (role != null && !role.isBlank()) {
            return "User '" + username + "' (" + role + ") ";
        }
        return "User '" + username + "' ";
    }

    private static String format(String pattern, Object... args) {
        if (args == null || args.length == 0) return pattern;
        // Use SLF4J formatter so `{}` placeholders work, without pulling in an extra dep.
        return org.slf4j.helpers.MessageFormatter.arrayFormat(pattern, args).getMessage();
    }
}
