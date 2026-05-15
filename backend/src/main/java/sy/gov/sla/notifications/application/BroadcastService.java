package sy.gov.sla.notifications.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.UserDepartmentMembership;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.identity.domain.User;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.notifications.api.BroadcastRecipientDto;
import sy.gov.sla.notifications.api.BroadcastRequest;
import sy.gov.sla.notifications.api.BroadcastResultDto;
import sy.gov.sla.organization.domain.Department;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * PR-14 (customer feedback A-1 / Q-G expansion) — manager-initiated
 * notifications. Three sender roles, each scope-bounded:
 *
 * <ul>
 *   <li>CENTRAL_SUPERVISOR — every state lawyer.</li>
 *   <li>BRANCH_HEAD — every state lawyer in the head's branch.</li>
 *   <li>SECTION_HEAD — every state lawyer in the head's (branch, dept).</li>
 * </ul>
 *
 * Reminders authored by lawyers (D-037) remain personal sticky-notes; this
 * is the separate broadcast channel customer Q-G asked for.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BroadcastService {

    private static final String NOTIFICATION_TYPE = "BROADCAST_MESSAGE";
    private static final String SENT_NOTIFICATION_TYPE = "BROADCAST_SENT";

    private final NotificationService notificationService;
    private final AuthorizationService authorizationService;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final UserRepository userRepo;
    /** Customer feedback round-2 (PR-15a): needed for CUSTOM scope to look up
     *  the (branchId) implied by each (departmentId). */
    private final DepartmentRepository departmentRepo;

    @Transactional(readOnly = true)
    public List<BroadcastRecipientDto> listEligibleRecipients(Long actorUserId,
                                                              Long branchIdFilter,
                                                              Long departmentIdFilter) {
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        SenderRole sender = senderRoleOf(ctx);
        // Compute the (branchId, departmentId) the caller may target. branchId/departmentId
        // null → "any reachable for this sender".
        EffectiveScope eff = effectiveListingScope(sender, ctx, branchIdFilter, departmentIdFilter);
        List<UserDepartmentMembership> rows = listLawyerMemberships(eff);

        if (rows.isEmpty()) return List.of();

        // Customer feedback round-2 (PR-15a iter): dedupe by userId so a lawyer
        // with two STATE_LAWYER memberships (e.g. FI + Appeal in the same
        // branch — see V30 demo seed) renders once in the picker, not once
        // per membership row. Same fix already lives in
        // listEligibleRecipientsUnion below — bringing this legacy listing
        // into line. Representative (branchId, departmentId) = the first row
        // we see for that user (membership rows arrive in id order).
        Map<Long, UserDepartmentMembership> firstRowByUser = new java.util.LinkedHashMap<>();
        for (UserDepartmentMembership m : rows) {
            firstRowByUser.putIfAbsent(m.getUserId(), m);
        }

        Map<Long, User> users = userRepo.findAllById(firstRowByUser.keySet()).stream()
                .filter(User::isActive)
                .collect(Collectors.toMap(User::getId, u -> u));

        return firstRowByUser.values().stream()
                .filter(m -> users.containsKey(m.getUserId()))
                .map(m -> {
                    User u = users.get(m.getUserId());
                    return new BroadcastRecipientDto(
                            u.getId(), u.getFullName(), u.getUsername(),
                            m.getBranchId(), m.getDepartmentId());
                })
                .sorted(Comparator
                        .comparing((BroadcastRecipientDto r) -> r.fullName(),
                                Comparator.nullsLast(String::compareTo))
                        .thenComparing(BroadcastRecipientDto::userId))
                .toList();
    }

    /**
     * Customer feedback round-2 (PR-15a): preview the union of lawyers reachable
     * by an arbitrary combination of branchIds / departmentIds / userIds. Used by
     * the new accumulative compose UI to show an accurate live recipient count.
     * Each id is gated against the caller's reach the same way {@link #broadcast}
     * does at send time.
     */
    @Transactional(readOnly = true)
    public List<BroadcastRecipientDto> listEligibleRecipientsUnion(Long actorUserId,
                                                                   List<Long> branchIds,
                                                                   List<Long> departmentIds,
                                                                   List<Long> userIds) {
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        SenderRole sender = senderRoleOf(ctx);

        List<Long> branches    = branchIds    == null ? List.of() : branchIds;
        List<Long> departments = departmentIds == null ? List.of() : departmentIds;
        List<Long> users       = userIds      == null ? List.of() : userIds;

        if (branches.isEmpty() && departments.isEmpty() && users.isEmpty()) {
            // Empty selection: keep the legacy "show me my reachable lawyers"
            // behaviour so the picker has something to show.
            return listEligibleRecipients(actorUserId, null, null);
        }

        // Customer feedback round-2 (PR-15a iteration 3): same narrowing
        // semantics as resolveCustom — a section ticked under a branch
        // restricts that branch to that section. See resolveCustom for the
        // full reasoning. The preview must compute exactly what broadcast
        // would send so the count and the recipient list don't disagree.

        Map<Long, UserDepartmentMembership> chosen = new java.util.LinkedHashMap<>();

        java.util.function.Consumer<List<UserDepartmentMembership>> absorb = rows -> {
            for (UserDepartmentMembership m : rows) {
                chosen.putIfAbsent(m.getUserId(), m);
            }
        };

        // Build (branch → picked depts) map, validating auth as we go.
        Map<Long, java.util.Set<Long>> deptsByBranch = new java.util.LinkedHashMap<>();
        for (Long d : departments) {
            Department dept = departmentRepo.findById(d).orElseThrow(() ->
                    new NotFoundException("Department not found: " + d));
            Long branchOfDept = dept.getBranchId();
            if (sender == SenderRole.BRANCH_HEAD
                    && !ctx.headOfBranches().contains(branchOfDept)) {
                throw new ForbiddenException("BRANCH_HEAD cannot preview outside own branch");
            }
            if (sender == SenderRole.SECTION_HEAD
                    && !ctx.isSectionHeadOf(branchOfDept, d)) {
                throw new ForbiddenException("SECTION_HEAD cannot preview outside own section");
            }
            deptsByBranch.computeIfAbsent(branchOfDept, k -> new java.util.LinkedHashSet<>()).add(d);
        }

        // Per-branch: narrowed if any of its depts are picked, whole branch otherwise.
        for (Long b : branches) {
            if (sender == SenderRole.SECTION_HEAD) {
                throw new ForbiddenException("SECTION_HEAD cannot preview a whole branch");
            }
            if (sender == SenderRole.BRANCH_HEAD && !ctx.headOfBranches().contains(b)) {
                throw new ForbiddenException("BRANCH_HEAD cannot preview outside own branch");
            }
            Set<Long> narrowedDepts = deptsByBranch.get(b);
            if (narrowedDepts != null && !narrowedDepts.isEmpty()) {
                for (Long d : narrowedDepts) {
                    absorb.accept(membershipRepo
                            .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                                    b, d, MembershipType.STATE_LAWYER));
                }
            } else {
                absorb.accept(membershipRepo
                        .findByBranchIdAndMembershipTypeAndActiveTrue(b, MembershipType.STATE_LAWYER));
            }
        }

        // Depts whose parent branch was NOT picked → include them on their own.
        for (var entry : deptsByBranch.entrySet()) {
            Long branchOfDept = entry.getKey();
            if (branches.contains(branchOfDept)) continue;
            for (Long d : entry.getValue()) {
                absorb.accept(membershipRepo
                        .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                                branchOfDept, d, MembershipType.STATE_LAWYER));
            }
        }

        if (!users.isEmpty()) {
            Set<Long> reachable = reachableLawyerIds(sender, ctx);
            List<Long> outside = new ArrayList<>();
            for (Long uid : users) if (!reachable.contains(uid)) outside.add(uid);
            if (!outside.isEmpty()) {
                throw new ForbiddenException(
                        "Some recipients are outside your broadcast scope: " + outside);
            }
            // Look up the membership row for the explicit user ids so the preview
            // can show a (branch, dept) label.
            for (Long uid : users) {
                if (chosen.containsKey(uid)) continue;
                membershipRepo.findByUserIdAndActiveTrue(uid).stream()
                        .filter(m -> m.getMembershipType() == MembershipType.STATE_LAWYER)
                        .findFirst()
                        .ifPresent(m -> chosen.put(uid, m));
            }
        }

        if (chosen.isEmpty()) return List.of();

        Set<Long> activeIds = userRepo.findAllById(chosen.keySet()).stream()
                .filter(User::isActive)
                .map(User::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<Long, User> usersById = userRepo.findAllById(activeIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return chosen.entrySet().stream()
                .filter(e -> activeIds.contains(e.getKey()))
                .map(e -> {
                    User u = usersById.get(e.getKey());
                    UserDepartmentMembership m = e.getValue();
                    return new BroadcastRecipientDto(
                            u.getId(), u.getFullName(), u.getUsername(),
                            m.getBranchId(), m.getDepartmentId());
                })
                .sorted(Comparator
                        .comparing((BroadcastRecipientDto r) -> r.fullName(),
                                Comparator.nullsLast(String::compareTo))
                        .thenComparing(BroadcastRecipientDto::userId))
                .toList();
    }

    public BroadcastResultDto broadcast(Long actorUserId, BroadcastRequest req) {
        if (req == null || req.scope() == null) {
            throw new BadRequestException("INVALID_BROADCAST", "scope is required");
        }
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        SenderRole sender = senderRoleOf(ctx);

        Set<Long> recipientIds = resolveRecipients(sender, ctx, req);
        recipientIds.remove(actorUserId); // never notify the sender themselves

        if (recipientIds.isEmpty()) {
            throw new BadRequestException("NO_RECIPIENTS",
                    "No active state-lawyer recipients matched this broadcast");
        }

        for (Long uid : recipientIds) {
            notificationService.createInternal(
                    uid, NOTIFICATION_TYPE,
                    req.title().trim(), req.body().trim(),
                    null, null);
        }

        // Sent-items: also drop a copy of the broadcast in the sender's own inbox
        // so they can review what they've sent (customer request).
        String senderBody = req.body().trim()
                + "\n\nتم الإرسال إلى " + recipientIds.size() + " مستلمًا.";
        notificationService.createInternal(
                actorUserId, SENT_NOTIFICATION_TYPE,
                req.title().trim(), senderBody,
                null, null);

        UserActionLog.action("broadcast \"{}\" -> {} recipients (scope={})",
                req.title(), recipientIds.size(), req.scope());

        return new BroadcastResultDto(recipientIds.size());
    }

    // ────────────────────────────────────────────────────────────
    // helpers
    // ────────────────────────────────────────────────────────────

    private enum SenderRole { ADMIN, BRANCH_HEAD, SECTION_HEAD }

    private record EffectiveScope(BroadcastRequest.Scope scope, Long branchId, Long departmentId) {}

    private static SenderRole senderRoleOf(AuthorizationContext ctx) {
        if (ctx.isCentralSupervisor()) return SenderRole.ADMIN;
        if (!ctx.headOfBranches().isEmpty()) return SenderRole.BRANCH_HEAD;
        boolean isSectionHead = ctx.departmentMemberships().stream().anyMatch(
                m -> m.active() && m.type() == MembershipType.SECTION_HEAD
                        && m.branchId() != null && m.departmentId() != null);
        if (isSectionHead) return SenderRole.SECTION_HEAD;
        throw new ForbiddenException(
                "Only CENTRAL_SUPERVISOR, BRANCH_HEAD, or SECTION_HEAD may broadcast");
    }

    private static EffectiveScope effectiveListingScope(SenderRole sender,
                                                        AuthorizationContext ctx,
                                                        Long branchIdFilter,
                                                        Long departmentIdFilter) {
        switch (sender) {
            case ADMIN -> {
                if (branchIdFilter != null && departmentIdFilter != null) {
                    return new EffectiveScope(BroadcastRequest.Scope.DEPARTMENT,
                            branchIdFilter, departmentIdFilter);
                }
                if (branchIdFilter != null) {
                    return new EffectiveScope(BroadcastRequest.Scope.BRANCH, branchIdFilter, null);
                }
                return new EffectiveScope(BroadcastRequest.Scope.ALL, null, null);
            }
            case BRANCH_HEAD -> {
                Long ownBranch = ctx.headOfBranches().iterator().next();
                if (branchIdFilter != null && !branchIdFilter.equals(ownBranch)) {
                    throw new ForbiddenException("BRANCH_HEAD cannot list lawyers outside own branch");
                }
                if (departmentIdFilter != null) {
                    return new EffectiveScope(BroadcastRequest.Scope.DEPARTMENT,
                            ownBranch, departmentIdFilter);
                }
                return new EffectiveScope(BroadcastRequest.Scope.BRANCH, ownBranch, null);
            }
            case SECTION_HEAD -> {
                UserDepartmentMembership ownership = ctx.departmentMemberships().stream()
                        .filter(m -> m.active() && m.type() == MembershipType.SECTION_HEAD
                                && m.branchId() != null && m.departmentId() != null)
                        .findFirst()
                        .map(m -> UserDepartmentMembership.builder()
                                .branchId(m.branchId()).departmentId(m.departmentId()).build())
                        .orElseThrow();
                if (branchIdFilter != null && !branchIdFilter.equals(ownership.getBranchId())) {
                    throw new ForbiddenException("SECTION_HEAD cannot list lawyers outside own section");
                }
                if (departmentIdFilter != null
                        && !departmentIdFilter.equals(ownership.getDepartmentId())) {
                    throw new ForbiddenException("SECTION_HEAD cannot list lawyers outside own section");
                }
                return new EffectiveScope(BroadcastRequest.Scope.DEPARTMENT,
                        ownership.getBranchId(), ownership.getDepartmentId());
            }
        }
        throw new ForbiddenException("Unsupported sender role for broadcast");
    }

    private List<UserDepartmentMembership> listLawyerMemberships(EffectiveScope eff) {
        switch (eff.scope()) {
            case ALL:
                return membershipRepo.findByMembershipTypeAndActiveTrue(MembershipType.STATE_LAWYER);
            case BRANCH:
                return membershipRepo.findByBranchIdAndMembershipTypeAndActiveTrue(
                        eff.branchId(), MembershipType.STATE_LAWYER);
            case DEPARTMENT:
                return membershipRepo.findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                        eff.branchId(), eff.departmentId(), MembershipType.STATE_LAWYER);
            case USERS:
            default:
                return List.of();
        }
    }

    private Set<Long> resolveRecipients(SenderRole sender, AuthorizationContext ctx,
                                        BroadcastRequest req) {
        // Customer feedback round-2 (PR-15a): branchIds / departmentIds let
        // an admin (or branch head) target several branches / sections in
        // one broadcast. The single-valued branchId/departmentId still work
        // and are merged into the union via effective*Ids().
        switch (req.scope()) {
            case ALL -> {
                if (sender != SenderRole.ADMIN) {
                    throw new ForbiddenException("Only CENTRAL_SUPERVISOR may broadcast to ALL");
                }
                return distinctActiveLawyerIds(
                        membershipRepo.findByMembershipTypeAndActiveTrue(MembershipType.STATE_LAWYER));
            }
            case BRANCH -> {
                List<Long> branches = req.effectiveBranchIds();
                if (branches.isEmpty()) {
                    throw new BadRequestException("INVALID_BROADCAST",
                            "branchId(s) required for BRANCH scope");
                }
                if (sender == SenderRole.SECTION_HEAD) {
                    throw new ForbiddenException("SECTION_HEAD cannot broadcast to a whole branch");
                }
                if (sender == SenderRole.BRANCH_HEAD) {
                    for (Long b : branches) {
                        if (!ctx.headOfBranches().contains(b)) {
                            throw new ForbiddenException(
                                    "BRANCH_HEAD cannot broadcast outside own branch");
                        }
                    }
                }
                List<UserDepartmentMembership> rows = new ArrayList<>();
                for (Long b : branches) {
                    rows.addAll(membershipRepo
                            .findByBranchIdAndMembershipTypeAndActiveTrue(b, MembershipType.STATE_LAWYER));
                }
                return distinctActiveLawyerIds(rows);
            }
            case DEPARTMENT -> {
                List<Long> branches = req.effectiveBranchIds();
                List<Long> departments = req.effectiveDepartmentIds();
                if (branches.isEmpty() || departments.isEmpty()) {
                    throw new BadRequestException("INVALID_BROADCAST",
                            "branchId(s) and departmentId(s) required for DEPARTMENT scope");
                }
                if (sender == SenderRole.BRANCH_HEAD) {
                    for (Long b : branches) {
                        if (!ctx.headOfBranches().contains(b)) {
                            throw new ForbiddenException(
                                    "BRANCH_HEAD cannot broadcast outside own branch");
                        }
                    }
                }
                if (sender == SenderRole.SECTION_HEAD) {
                    for (Long b : branches) {
                        for (Long d : departments) {
                            if (!ctx.isSectionHeadOf(b, d)) {
                                throw new ForbiddenException(
                                        "SECTION_HEAD cannot broadcast outside own section");
                            }
                        }
                    }
                }
                List<UserDepartmentMembership> rows = new ArrayList<>();
                for (Long b : branches) {
                    for (Long d : departments) {
                        rows.addAll(membershipRepo
                                .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                                        b, d, MembershipType.STATE_LAWYER));
                    }
                }
                return distinctActiveLawyerIds(rows);
            }
            case USERS -> {
                if (req.userIds() == null || req.userIds().isEmpty()) {
                    throw new BadRequestException("INVALID_BROADCAST",
                            "userIds is required for USERS scope");
                }
                Set<Long> requested = new LinkedHashSet<>(req.userIds());
                Set<Long> reachable = reachableLawyerIds(sender, ctx);
                List<Long> outsideScope = new ArrayList<>();
                for (Long id : requested) if (!reachable.contains(id)) outsideScope.add(id);
                if (!outsideScope.isEmpty()) {
                    throw new ForbiddenException(
                            "Some recipients are outside your broadcast scope: " + outsideScope);
                }
                return requested;
            }
            case CUSTOM -> {
                return resolveCustom(sender, ctx, req);
            }
        }
        return Set.of();
    }

    /**
     * Customer feedback round-2 (PR-15a iteration 3): CUSTOM scope.
     *
     * Per the customer's clarification on the broadcast composer:
     * a section ticked under a branch should NARROW that branch to just that
     * section, not pile up in addition. Mental model: the user navigates
     * "branch → section". Sections override their parent branch's "whole
     * branch" inclusion. Sections of OTHER branches (or sections without their
     * branch picked) still get included on their own.
     *
     * Concretely we compute:
     *   coveredPairs = ∅
     *   for branch B in branchIds:
     *       if any dept in departmentIds belongs to B:
     *           coveredPairs += {(B, d) for those depts}     // narrowed
     *       else:
     *           coveredPairs += {(B, all of B's depts)}      // whole branch
     *   for dept D in departmentIds whose branch is NOT in branchIds:
     *       coveredPairs += {(branchOf(D), D)}
     *
     *   recipients = lawyers whose (branch_id, dept_id) ∈ coveredPairs
     *              ∪ (explicitly named userIds that are reachable lawyers)
     */
    private Set<Long> resolveCustom(SenderRole sender, AuthorizationContext ctx,
                                    BroadcastRequest req) {
        List<Long> branches    = req.effectiveBranchIds();
        List<Long> departments = req.effectiveDepartmentIds();
        List<Long> users       = req.userIds() == null ? List.of() : req.userIds();

        if (branches.isEmpty() && departments.isEmpty() && users.isEmpty()) {
            throw new BadRequestException("INVALID_BROADCAST",
                    "اختيار مخصّص يتطلّب على الأقل فرعًا أو قسمًا أو محاميًا واحدًا");
        }

        Set<Long> recipients = new LinkedHashSet<>();

        // ── Step 1: build (branch → picked depts) map, validating auth ──
        java.util.Map<Long, java.util.Set<Long>> deptsByBranch = new java.util.LinkedHashMap<>();
        for (Long d : departments) {
            Department dept = departmentRepo.findById(d).orElseThrow(() ->
                    new NotFoundException("Department not found: " + d));
            Long branchOfDept = dept.getBranchId();
            if (sender == SenderRole.BRANCH_HEAD
                    && !ctx.headOfBranches().contains(branchOfDept)) {
                throw new ForbiddenException(
                        "BRANCH_HEAD cannot broadcast outside own branch");
            }
            if (sender == SenderRole.SECTION_HEAD
                    && !ctx.isSectionHeadOf(branchOfDept, d)) {
                throw new ForbiddenException(
                        "SECTION_HEAD cannot broadcast outside own section");
            }
            deptsByBranch.computeIfAbsent(branchOfDept, k -> new java.util.LinkedHashSet<>()).add(d);
        }

        // ── Step 2: per-branch resolution (narrowed if depts picked, whole otherwise) ──
        for (Long b : branches) {
            if (sender == SenderRole.SECTION_HEAD) {
                throw new ForbiddenException(
                        "SECTION_HEAD cannot broadcast to a whole branch");
            }
            if (sender == SenderRole.BRANCH_HEAD && !ctx.headOfBranches().contains(b)) {
                throw new ForbiddenException(
                        "BRANCH_HEAD cannot broadcast outside own branch");
            }

            Set<Long> narrowedDepts = deptsByBranch.get(b);
            if (narrowedDepts != null && !narrowedDepts.isEmpty()) {
                // User picked specific sections under this branch → restrict.
                for (Long d : narrowedDepts) {
                    recipients.addAll(distinctActiveLawyerIds(
                            membershipRepo
                                .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                                        b, d, MembershipType.STATE_LAWYER)));
                }
            } else {
                // No section narrowing for this branch → include the whole branch.
                recipients.addAll(distinctActiveLawyerIds(
                        membershipRepo.findByBranchIdAndMembershipTypeAndActiveTrue(
                                b, MembershipType.STATE_LAWYER)));
            }
        }

        // ── Step 3: depts whose parent branch was NOT picked → include them on their own ──
        for (var entry : deptsByBranch.entrySet()) {
            Long branchOfDept = entry.getKey();
            if (branches.contains(branchOfDept)) continue;   // already handled in Step 2
            for (Long d : entry.getValue()) {
                recipients.addAll(distinctActiveLawyerIds(
                        membershipRepo
                            .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                                    branchOfDept, d, MembershipType.STATE_LAWYER)));
            }
        }

        // ── Step 4: explicitly chosen lawyers ──
        if (!users.isEmpty()) {
            Set<Long> reachable = reachableLawyerIds(sender, ctx);
            List<Long> outside = new ArrayList<>();
            for (Long uid : users) if (!reachable.contains(uid)) outside.add(uid);
            if (!outside.isEmpty()) {
                throw new ForbiddenException(
                        "Some recipients are outside your broadcast scope: " + outside);
            }
            recipients.addAll(users);
        }

        return recipients;
    }

    private Set<Long> reachableLawyerIds(SenderRole sender, AuthorizationContext ctx) {
        List<UserDepartmentMembership> memberships;
        switch (sender) {
            case ADMIN -> memberships = membershipRepo
                    .findByMembershipTypeAndActiveTrue(MembershipType.STATE_LAWYER);
            case BRANCH_HEAD -> {
                Long ownBranch = ctx.headOfBranches().iterator().next();
                memberships = membershipRepo
                        .findByBranchIdAndMembershipTypeAndActiveTrue(
                                ownBranch, MembershipType.STATE_LAWYER);
            }
            case SECTION_HEAD -> {
                UserDepartmentMembership own = ctx.departmentMemberships().stream()
                        .filter(m -> m.active() && m.type() == MembershipType.SECTION_HEAD
                                && m.branchId() != null && m.departmentId() != null)
                        .findFirst()
                        .map(m -> UserDepartmentMembership.builder()
                                .branchId(m.branchId()).departmentId(m.departmentId()).build())
                        .orElseThrow();
                memberships = membershipRepo
                        .findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                                own.getBranchId(), own.getDepartmentId(),
                                MembershipType.STATE_LAWYER);
            }
            default -> memberships = List.of();
        }
        return distinctActiveLawyerIds(memberships);
    }

    private Set<Long> distinctActiveLawyerIds(List<UserDepartmentMembership> memberships) {
        if (memberships.isEmpty()) return new LinkedHashSet<>();
        Set<Long> ids = memberships.stream()
                .map(UserDepartmentMembership::getUserId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> activeIds = userRepo.findAllById(ids).stream()
                .filter(User::isActive)
                .map(User::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return activeIds;
    }
}
