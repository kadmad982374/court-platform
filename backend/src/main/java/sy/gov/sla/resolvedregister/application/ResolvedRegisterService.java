package sy.gov.sla.resolvedregister.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationContext.DepartmentMembership;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.resolvedregister.api.ResolvedRegisterEntryDto;
import sy.gov.sla.resolvedregister.infrastructure.ResolvedRegisterQueryDao;
import sy.gov.sla.resolvedregister.infrastructure.ResolvedRegisterQueryDao.QueryFilter;
import sy.gov.sla.resolvedregister.infrastructure.ResolvedRegisterQueryDao.ScopeFilter;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResolvedRegisterService {

    private final ResolvedRegisterQueryDao dao;
    private final AuthorizationService authorizationService;

    public List<ResolvedRegisterEntryDto> query(Integer year, Integer month, Long branchId,
                                                Long departmentId, String decisionType,
                                                Long actorUserId) {
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        ScopeFilter scope = buildScope(ctx);
        QueryFilter filter = new QueryFilter(year, month, branchId, departmentId, decisionType);
        return dao.query(filter, scope);
    }

    /** يبني ScopeFilter حسب D-021 (تطبيق Read scope على سجل الفصل). */
    private ScopeFilter buildScope(AuthorizationContext ctx) {
        if (ctx.isCentralSupervisor() || ctx.isReadOnlySupervisor() || ctx.isSpecialInspector()) {
            return ScopeFilter.all();
        }
        boolean lawyer = ctx.isStateLawyer();
        Set<Long> headBranches = ctx.headOfBranches();
        Set<Long> branchDeptKeys = new HashSet<>();
        for (DepartmentMembership m : ctx.departmentMemberships()) {
            if (!m.active()) continue;
            if ((m.type() == MembershipType.SECTION_HEAD || m.type() == MembershipType.ADMIN_CLERK)
                    && m.departmentId() != null && m.branchId() != null) {
                branchDeptKeys.add(m.branchId() * 1_000_000L + m.departmentId());
            }
        }

        // Priority: BRANCH_HEAD > SECTION_HEAD/CLERK > LAWYER (cumulative would need OR; here we
        // pick the most permissive single bucket that fully covers the user, otherwise UNION via
        // logical kind. For Phase 4 we choose simple precedence: a single user typically holds one
        // operational role at a time.)
        if (!headBranches.isEmpty()) return ScopeFilter.branches(headBranches);
        if (!branchDeptKeys.isEmpty()) return ScopeFilter.branchDeptPairs(branchDeptKeys);
        if (lawyer) return ScopeFilter.owner(ctx.userId());
        return ScopeFilter.none();
    }
}

