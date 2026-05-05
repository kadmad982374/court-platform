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
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.identity.domain.User;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.notifications.api.BroadcastRecipientDto;
import sy.gov.sla.notifications.api.BroadcastRequest;
import sy.gov.sla.notifications.api.BroadcastResultDto;

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

    private final NotificationService notificationService;
    private final AuthorizationService authorizationService;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final UserRepository userRepo;

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

        Set<Long> userIds = rows.stream()
                .map(UserDepartmentMembership::getUserId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<Long, User> users = userRepo.findAllById(userIds).stream()
                .filter(User::isActive)
                .collect(Collectors.toMap(User::getId, u -> u));

        // Use the row's (branchId, departmentId) so the picker shows the user
        // under the correct department even if they belong to multiple.
        return rows.stream()
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
        switch (req.scope()) {
            case ALL -> {
                if (sender != SenderRole.ADMIN) {
                    throw new ForbiddenException("Only CENTRAL_SUPERVISOR may broadcast to ALL");
                }
                return distinctActiveLawyerIds(
                        membershipRepo.findByMembershipTypeAndActiveTrue(MembershipType.STATE_LAWYER));
            }
            case BRANCH -> {
                if (req.branchId() == null) {
                    throw new BadRequestException("INVALID_BROADCAST", "branchId is required for BRANCH scope");
                }
                if (sender == SenderRole.SECTION_HEAD) {
                    throw new ForbiddenException("SECTION_HEAD cannot broadcast to a whole branch");
                }
                if (sender == SenderRole.BRANCH_HEAD
                        && !ctx.headOfBranches().contains(req.branchId())) {
                    throw new ForbiddenException("BRANCH_HEAD cannot broadcast outside own branch");
                }
                return distinctActiveLawyerIds(
                        membershipRepo.findByBranchIdAndMembershipTypeAndActiveTrue(
                                req.branchId(), MembershipType.STATE_LAWYER));
            }
            case DEPARTMENT -> {
                if (req.branchId() == null || req.departmentId() == null) {
                    throw new BadRequestException("INVALID_BROADCAST",
                            "branchId and departmentId are required for DEPARTMENT scope");
                }
                if (sender == SenderRole.BRANCH_HEAD
                        && !ctx.headOfBranches().contains(req.branchId())) {
                    throw new ForbiddenException("BRANCH_HEAD cannot broadcast outside own branch");
                }
                if (sender == SenderRole.SECTION_HEAD
                        && !ctx.isSectionHeadOf(req.branchId(), req.departmentId())) {
                    throw new ForbiddenException("SECTION_HEAD cannot broadcast outside own section");
                }
                return distinctActiveLawyerIds(
                        membershipRepo.findByBranchIdAndDepartmentIdAndMembershipTypeAndActiveTrue(
                                req.branchId(), req.departmentId(), MembershipType.STATE_LAWYER));
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
        }
        return Set.of();
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
