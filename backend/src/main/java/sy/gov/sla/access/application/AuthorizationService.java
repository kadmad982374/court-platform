package sy.gov.sla.access.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext.DepartmentMembership;
import sy.gov.sla.access.domain.*;
import sy.gov.sla.access.infrastructure.*;
import sy.gov.sla.common.exception.ForbiddenException;

import java.util.HashSet;
import java.util.Set;

/**
 * خدمة الصلاحيات المركزية للمرحلة 1.
 *
 * تطبق المبادئ الحاكمة من PROJECT_CONTEXT §10 و DOMAIN_BOUNDARIES §3:
 *  - نطاق الإدارة المركزية (CENTRAL_SUPERVISOR): قراءة شاملة، بدون تعديل افتراضي.
 *  - نطاق الفرع (BRANCH_HEAD): قراءة على فرعه فقط.
 *  - نطاق القسم (SECTION_HEAD / ADMIN_CLERK): العمل ضمن قسمهما فقط.
 *  - نطاق المحاكم الممنوحة (UserCourtAccess.active=true).
 *  - حجب صلاحيات الموظف الإداري عبر UserDelegatedPermission.granted=false.
 *
 * منطق ملكية الدعوى (canAccessCase / canModifyCase) يُطبَّق فعليًا في المرحلة 2
 * عند ظهور كيان LitigationCase. الواجهات هنا جاهزة لاستهلاكها لاحقًا.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthorizationService {

    private final UserRoleRepository userRoleRepo;
    private final RoleRepository roleRepo;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final UserCourtAccessRepository courtAccessRepo;
    private final UserDelegatedPermissionRepository delegatedRepo;

    public AuthorizationContext loadContext(Long userId) {
        Set<RoleType> roles = new HashSet<>();
        for (UserRole ur : userRoleRepo.findByUserId(userId)) {
            roleRepo.findById(ur.getRoleId()).ifPresent(r -> roles.add(r.getType()));
        }

        Set<DepartmentMembership> memberships = new HashSet<>();
        Set<Long> headOfBranches = new HashSet<>();
        for (UserDepartmentMembership m : membershipRepo.findByUserId(userId)) {
            memberships.add(new DepartmentMembership(
                    m.getBranchId(), m.getDepartmentId(), m.getMembershipType(), m.isActive()));
            if (m.isActive() && m.getMembershipType() == MembershipType.BRANCH_HEAD) {
                headOfBranches.add(m.getBranchId());
            }
        }

        Set<Long> grantedCourts = new HashSet<>();
        for (UserCourtAccess uca : courtAccessRepo.findByUserId(userId)) {
            if (uca.isActive()) grantedCourts.add(uca.getCourtId());
        }

        return new AuthorizationContext(userId, roles, headOfBranches, memberships, grantedCourts);
    }

    // ========== Scope checks (Phase 1) ==========

    public boolean canReadBranch(AuthorizationContext ctx, Long branchId) {
        return ctx.isCentralSupervisor()
                || ctx.isReadOnlySupervisor()
                || ctx.isSpecialInspector()
                || ctx.isBranchHeadOf(branchId)
                || ctx.departmentMemberships().stream()
                        .anyMatch(m -> m.active() && m.branchId().equals(branchId));
    }

    public boolean canReadDepartment(AuthorizationContext ctx, Long branchId, Long departmentId) {
        return ctx.isCentralSupervisor()
                || ctx.isReadOnlySupervisor()
                || ctx.isSpecialInspector()
                || ctx.isBranchHeadOf(branchId)
                || ctx.isSectionHeadOf(branchId, departmentId)
                || ctx.isAdminClerkOf(branchId, departmentId)
                || ctx.departmentMemberships().stream().anyMatch(m ->
                        m.active() && m.branchId().equals(branchId)
                        && departmentId.equals(m.departmentId()));
    }

    /**
     * هل يستطيع actor إدارة صلاحيات المحاكم لمستخدم مستهدف?
     * القاعدة (الوظيفية §3.5): رئيس القسم يمنح/يحجب لمحامي قسمه.
     * الموظف الإداري يستطيع ذلك فقط إذا فُوّضت له صلاحية MANAGE_COURT_ACCESS.
     */
    public void requireCanManageCourtAccess(AuthorizationContext actorCtx,
                                            Long targetBranchId, Long targetDepartmentId) {
        if (!canManageCourtAccess(actorCtx, targetBranchId, targetDepartmentId)) {
            throw new ForbiddenException("Not allowed to manage court access for this user");
        }
    }

    /**
     * نسخة منطقية (لا تُلقي استثناء) من {@link #requireCanManageCourtAccess}.
     * تجنب رمي استثناء من داخل ميثود ‎@Transactional يُستهلك في حلقة استكشاف
     * لأن إلقاء الاستثناء يُعلِّم المعاملة الأم بـ rollback-only ولو تمَّ ابتلاعه.
     */
    public boolean canManageCourtAccess(AuthorizationContext actorCtx,
                                        Long targetBranchId, Long targetDepartmentId) {
        return actorCtx.isSectionHeadOf(targetBranchId, targetDepartmentId)
                || (actorCtx.isAdminClerkOf(targetBranchId, targetDepartmentId)
                    && hasDelegatedPermission(actorCtx.userId(), DelegatedPermissionCode.MANAGE_COURT_ACCESS));
    }

    /**
     * هل يستطيع actor إدارة التفويضات (delegated permissions) لمستخدم مستهدف?
     * القاعدة (الوظيفية §3.5، D-004): فقط رئيس القسم يديرها لموظفه الإداري في نفس القسم.
     */
    public void requireCanManageDelegations(AuthorizationContext actorCtx,
                                            Long targetBranchId, Long targetDepartmentId) {
        if (!actorCtx.isSectionHeadOf(targetBranchId, targetDepartmentId)) {
            throw new ForbiddenException("Only the department's section head can manage delegations");
        }
    }

    public boolean hasDelegatedPermission(Long userId, DelegatedPermissionCode code) {
        return delegatedRepo.findByUserIdAndPermissionCode(userId, code)
                .map(UserDelegatedPermission::isGranted)
                .orElse(false);
    }

    public boolean hasCourtAccess(Long userId, Long courtId) {
        return courtAccessRepo.existsByUserIdAndCourtIdAndActiveTrue(userId, courtId);
    }

    /**
     * هل المستخدم عضو فعّال بالنوع المحدد في (branch, dept)؟
     * يُستخدم للتحقق من أن المحامي المُسنَد ينتمي للقسم نفسه.
     */
    public boolean isActiveMemberOf(Long userId, Long branchId, Long departmentId, MembershipType type) {
        return membershipRepo.findByUserIdAndActiveTrue(userId).stream().anyMatch(m ->
                m.getMembershipType() == type
                        && branchId.equals(m.getBranchId())
                        && departmentId.equals(m.getDepartmentId()));
    }

    /**
     * يُرجع كل الـ user IDs النشطين الذين لديهم العضوية المحددة في (branch, dept).
     * يُستخدم من وحدة notifications (Phase 6, D-038) لاختيار مستلمي إشعار قيد دعوى جديدة.
     */
    public java.util.List<Long> findActiveMemberUserIds(Long branchId, Long departmentId, MembershipType type) {
        return membershipRepo.findAll().stream()
                .filter(m -> m.isActive()
                        && m.getMembershipType() == type
                        && branchId.equals(m.getBranchId())
                        && departmentId.equals(m.getDepartmentId()))
                .map(UserDepartmentMembership::getUserId)
                .distinct()
                .toList();
    }

    // ========== Case-level authorization (Phase 2) ==========

    /**
     * هل يستطيع actor قراءة دعوى موجودة؟ مرجع: D-021.
     */
    public boolean canReadCase(AuthorizationContext ctx, Long branchId, Long departmentId, Long ownerUserId) {
        if (ctx.isCentralSupervisor() || ctx.isReadOnlySupervisor() || ctx.isSpecialInspector()) return true;
        if (ctx.isBranchHeadOf(branchId)) return true;
        if (ctx.isSectionHeadOf(branchId, departmentId)) return true;
        if (ctx.isAdminClerkOf(branchId, departmentId)) return true;
        if (ctx.isStateLawyer() && ctx.userId().equals(ownerUserId)) return true;
        return false;
    }

    public void requireReadAccessToCase(AuthorizationContext ctx, Long branchId,
                                        Long departmentId, Long ownerUserId) {
        if (!canReadCase(ctx, branchId, departmentId, ownerUserId)) {
            throw new ForbiddenException("Case is outside actor read scope");
        }
    }

    /**
     * Read-access check for a stage that belongs to a case. Mirrors
     * {@link #requireReadAccessToCase} but ORs two scopes:
     *   - the stage's own (branchId, departmentId), e.g. APPEAL after promotion;
     *   - the case's original creation (branchId, departmentId), e.g. FIRST_INSTANCE.
     *
     * Rationale (blueprint §9 + D-026): the case lifecycle spans many stages.
     * The section-head / admin-clerk who originally registered the case must
     * keep visibility on EVERY stage it spawns — including the new APPEAL
     * stage and the historical (now read-only) stages — even though those
     * stages live in a different department. Without this OR, the actor who
     * is allowed to *promote* a stage immediately loses the ability to *open*
     * the stage they just promoted, which surfaces as the noisy "تعذّر تحميل"
     * banner the user reported on the case detail page after promote-to-appeal
     * and promote-to-execution.
     */
    public void requireReadAccessToStage(AuthorizationContext ctx,
                                         Long stageBranchId, Long stageDepartmentId,
                                         Long caseCreatedBranchId, Long caseCreatedDepartmentId,
                                         Long ownerUserId) {
        if (canReadCase(ctx, stageBranchId, stageDepartmentId, ownerUserId)) return;
        if (caseCreatedBranchId != null && caseCreatedDepartmentId != null
                && canReadCase(ctx, caseCreatedBranchId, caseCreatedDepartmentId, ownerUserId)) return;
        throw new ForbiddenException("Stage is outside actor read scope");
    }

    /**
     * هل يستطيع actor إجراء عملية إدارة (create/update/assign) ضمن نطاق (branch, dept)؟
     * يُسمح لرئيس القسم دائمًا، وللموظف الإداري إن مُنح التفويض المطلوب.
     */
    public void requireCaseManagement(AuthorizationContext ctx, Long branchId, Long departmentId,
                                      DelegatedPermissionCode requiredDelegationForClerk) {
        if (ctx.isSectionHeadOf(branchId, departmentId)) return;
        if (ctx.isAdminClerkOf(branchId, departmentId)
                && hasDelegatedPermission(ctx.userId(), requiredDelegationForClerk)) return;
        throw new ForbiddenException("Not allowed to manage cases in this department");
    }

    /**
     * منفذ ملكية الدعوى: يُحقَن من وحدة litigationregistration (انظر CaseOwnershipPort/Adapter).
     * setter بدلًا من constructor injection لتجنّب الاعتمادات الدائرية بين الوحدات.
     */
    private CaseOwnershipPort caseOwnershipPort;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setCaseOwnershipPort(CaseOwnershipPort port) { this.caseOwnershipPort = port; }

    /**
     * يفرض أن المستخدم الحالي هو مالك الدعوى. يُستخدم في endpoints المحامي-centric.
     * مرجع: الوظيفية §4.1.
     */
    public void requireCaseOwnership(AuthorizationContext ctx, Long caseId) {
        if (caseOwnershipPort == null) {
            throw new ForbiddenException("Case ownership port not available");
        }
        Long owner = caseOwnershipPort.findCurrentOwner(caseId)
                .orElseThrow(() -> new ForbiddenException("Case has no owner"));
        if (!owner.equals(ctx.userId())) {
            throw new ForbiddenException("Case ownership rule not satisfied");
        }
    }
}

