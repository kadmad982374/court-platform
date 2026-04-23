package sy.gov.sla.execution.application;

import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationContext.DepartmentMembership;
import sy.gov.sla.access.domain.MembershipType;

import java.util.HashSet;
import java.util.Set;

/**
 * Read scope على execution_files. مرجع: D-032 (Phase 5).
 *
 * مرآة منطق ResolvedRegisterService.buildScope مع فرق وحيد:
 * STATE_LAWYER يُطابَق على {@code execution_files.assigned_user_id}
 * (وليس على {@code litigation_cases.current_owner_user_id}) لأن الملف التنفيذي
 * مسار مستقل بـ ownership خاص به.
 *
 * Precedence: ALL (CENTRAL/READ_ONLY/SPECIAL) > BRANCHES (BRANCH_HEAD)
 *           > BRANCH_DEPT_PAIRS (SECTION_HEAD/ADMIN_CLERK) > ASSIGNED_USER (STATE_LAWYER)
 *           > NONE.
 */
public record ExecutionScope(
        Kind kind,
        Set<Long> branchIds,
        Set<Long> branchDeptKeys,
        Long assignedUserId
) {

    public enum Kind { ALL, BRANCHES, BRANCH_DEPT_PAIRS, ASSIGNED_USER, NONE }

    public static ExecutionScope all() { return new ExecutionScope(Kind.ALL, Set.of(), Set.of(), null); }
    public static ExecutionScope none() { return new ExecutionScope(Kind.NONE, Set.of(), Set.of(), null); }
    public static ExecutionScope branches(Set<Long> b) { return new ExecutionScope(Kind.BRANCHES, b, Set.of(), null); }
    public static ExecutionScope branchDeptPairs(Set<Long> keys) { return new ExecutionScope(Kind.BRANCH_DEPT_PAIRS, Set.of(), keys, null); }
    public static ExecutionScope assigned(Long userId) { return new ExecutionScope(Kind.ASSIGNED_USER, Set.of(), Set.of(), userId); }

    public static long encodeBranchDeptKey(long branchId, long departmentId) {
        return branchId * 1_000_000L + departmentId;
    }

    /** يبني الـ scope من سياق التفويض. مرآة ResolvedRegisterService.buildScope. */
    public static ExecutionScope from(AuthorizationContext ctx) {
        if (ctx.isCentralSupervisor() || ctx.isReadOnlySupervisor() || ctx.isSpecialInspector()) {
            return all();
        }
        Set<Long> headBranches = ctx.headOfBranches();
        Set<Long> branchDeptKeys = new HashSet<>();
        for (DepartmentMembership m : ctx.departmentMemberships()) {
            if (!m.active()) continue;
            if ((m.type() == MembershipType.SECTION_HEAD || m.type() == MembershipType.ADMIN_CLERK)
                    && m.departmentId() != null && m.branchId() != null) {
                branchDeptKeys.add(encodeBranchDeptKey(m.branchId(), m.departmentId()));
            }
        }
        if (!headBranches.isEmpty()) return branches(headBranches);
        if (!branchDeptKeys.isEmpty()) return branchDeptPairs(branchDeptKeys);
        if (ctx.isStateLawyer()) return assigned(ctx.userId());
        return none();
    }

    /**
     * هل الملف التنفيذي المحدَّد ضمن هذا الـ scope؟
     * مستخدمة للتحقق على السجل المفرد بعد القراءة (GET /{id}).
     */
    public boolean matches(Long fileBranchId, Long fileDepartmentId, Long fileAssignedUserId) {
        switch (kind) {
            case ALL: return true;
            case BRANCHES: return branchIds.contains(fileBranchId);
            case BRANCH_DEPT_PAIRS:
                return branchDeptKeys.contains(encodeBranchDeptKey(fileBranchId, fileDepartmentId));
            case ASSIGNED_USER:
                return assignedUserId != null && assignedUserId.equals(fileAssignedUserId);
            case NONE:
            default:
                return false;
        }
    }
}

