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
 *
 * <p>Customer feedback round-2 (PR-15a): {@code branchIds} and {@code departmentIds}
 * accept multiple targets — admin can broadcast to several branches at once, and a
 * branch head / admin can broadcast to several sections at once. The single-valued
 * {@code branchId} / {@code departmentId} are kept for backwards compatibility; if
 * both shapes are sent the server uses the union.
 */
public record BroadcastRequest(
        @NotNull Scope scope,
        Long branchId,
        Long departmentId,
        List<Long> branchIds,
        List<Long> departmentIds,
        List<Long> userIds,
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 2000) String body
) {
    /**
     * Customer feedback round-2 (PR-15a iteration): {@code CUSTOM} computes the
     * UNION of (lawyers in branchIds) ∪ (lawyers in departmentIds) ∪ (named
     * userIds). Each individual id is gated against the caller's reach. Lets a
     * single broadcast target several branches AND several sections AND specific
     * lawyers in one shot — replacing the older mutually-exclusive scope dropdown.
     */
    public enum Scope { ALL, BRANCH, DEPARTMENT, USERS, CUSTOM }

    /** Union of legacy {@code branchId} + {@code branchIds}, deduplicated, never null. */
    public List<Long> effectiveBranchIds() {
        java.util.LinkedHashSet<Long> out = new java.util.LinkedHashSet<>();
        if (branchId != null) out.add(branchId);
        if (branchIds != null) for (Long b : branchIds) if (b != null) out.add(b);
        return new java.util.ArrayList<>(out);
    }

    /** Union of legacy {@code departmentId} + {@code departmentIds}, deduplicated, never null. */
    public List<Long> effectiveDepartmentIds() {
        java.util.LinkedHashSet<Long> out = new java.util.LinkedHashSet<>();
        if (departmentId != null) out.add(departmentId);
        if (departmentIds != null) for (Long d : departmentIds) if (d != null) out.add(d);
        return new java.util.ArrayList<>(out);
    }
}
