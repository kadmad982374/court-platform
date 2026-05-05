package sy.gov.sla.reports.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationContext.DepartmentMembership;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.reports.api.CaseSummaryDto;
import sy.gov.sla.reports.infrastructure.CaseSummaryDao;
import sy.gov.sla.reports.infrastructure.CaseSummaryDao.ScopeFilter;

import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportsService {

    private final CaseSummaryDao dao;
    private final AuthorizationService authorizationService;

    public CaseSummaryDto caseSummary(Long actorUserId) {
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        return dao.query(buildScope(ctx));
    }

    /** Mirror of {@code ResolvedRegisterService.buildScope} (D-021). */
    private ScopeFilter buildScope(AuthorizationContext ctx) {
        if (ctx.isCentralSupervisor() || ctx.isReadOnlySupervisor() || ctx.isSpecialInspector()) {
            return ScopeFilter.all();
        }
        Set<Long> headBranches = ctx.headOfBranches();
        Set<Long> branchDeptKeys = new HashSet<>();
        for (DepartmentMembership m : ctx.departmentMemberships()) {
            if (!m.active()) continue;
            if ((m.type() == MembershipType.SECTION_HEAD || m.type() == MembershipType.ADMIN_CLERK)
                    && m.departmentId() != null && m.branchId() != null) {
                branchDeptKeys.add(m.branchId() * 1_000_000L + m.departmentId());
            }
        }
        if (!headBranches.isEmpty()) return ScopeFilter.branches(headBranches);
        if (!branchDeptKeys.isEmpty()) return ScopeFilter.branchDeptPairs(branchDeptKeys);
        if (ctx.isStateLawyer()) return ScopeFilter.owner(ctx.userId());
        return ScopeFilter.none();
    }
}
