package sy.gov.sla.notifications.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * PR-14 (customer feedback A-1 / Q-G expansion) — broadcast a notification to
 * a scope-bounded set of state lawyers. The server re-validates the
 * (scope, branchId, departmentId, userIds) tuple against the caller's role
 * before fan-out.
 *
 * <p>Scopes:
 * <ul>
 *   <li>{@code ALL} — every active state lawyer (CENTRAL_SUPERVISOR only).</li>
 *   <li>{@code BRANCH} — every active state lawyer in the given branch
 *       (CENTRAL_SUPERVISOR, or BRANCH_HEAD of that branch).</li>
 *   <li>{@code DEPARTMENT} — every active state lawyer in (branchId,
 *       departmentId) (CENTRAL_SUPERVISOR, or BRANCH_HEAD of that branch,
 *       or SECTION_HEAD of that (branch, dept)).</li>
 *   <li>{@code USERS} — explicit user-id list. Each user must be reachable
 *       by the caller's role under the rules above.</li>
 * </ul>
 */
public record BroadcastRequest(
        @NotNull Scope scope,
        Long branchId,
        Long departmentId,
        List<Long> userIds,
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 2000) String body
) {
    public enum Scope { ALL, BRANCH, DEPARTMENT, USERS }
}
