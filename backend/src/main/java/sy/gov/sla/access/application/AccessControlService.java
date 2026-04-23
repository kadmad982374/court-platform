package sy.gov.sla.access.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.api.*;
import sy.gov.sla.access.domain.*;
import sy.gov.sla.access.infrastructure.*;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.domain.Court;
import sy.gov.sla.organization.infrastructure.CourtRepository;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class AccessControlService {

    private final UserRepository userRepository;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final UserCourtAccessRepository courtAccessRepo;
    private final UserDelegatedPermissionRepository delegatedRepo;
    private final CourtRepository courtRepository;
    private final AuthorizationService authorizationService;

    @Transactional(readOnly = true)
    public List<DepartmentMembershipDto> listMemberships(Long userId, Long actorUserId) {
        // كل مستخدم يستطيع قراءة عضوياته. غيره يستطيع إن كان ضمن نطاقه.
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }
        if (!userId.equals(actorUserId)) {
            AuthorizationContext actor = authorizationService.loadContext(actorUserId);
            boolean canSee = actor.isCentralSupervisor()
                    || actor.isReadOnlySupervisor()
                    || actor.isSpecialInspector()
                    || sharesScope(actor, userId);
            if (!canSee) throw new ForbiddenException("Cannot read this user's memberships");
        }
        return membershipRepo.findByUserId(userId).stream()
                .map(m -> new DepartmentMembershipDto(
                        m.getId(), m.getUserId(), m.getBranchId(), m.getDepartmentId(),
                        m.getMembershipType(), m.isPrimary(), m.isActive()))
                .toList();
    }

    private boolean sharesScope(AuthorizationContext actor, Long targetUserId) {
        // إن كان actor رئيس فرع/قسم لنفس فرع/قسم target.
        for (var m : membershipRepo.findByUserId(targetUserId)) {
            if (!m.isActive()) continue;
            if (actor.isBranchHeadOf(m.getBranchId())) return true;
            if (m.getDepartmentId() != null
                    && (actor.isSectionHeadOf(m.getBranchId(), m.getDepartmentId())
                        || actor.isAdminClerkOf(m.getBranchId(), m.getDepartmentId()))) {
                return true;
            }
        }
        return false;
    }

    public List<CourtAccessDto> updateCourtAccess(Long targetUserId, UpdateCourtAccessRequest req, Long actorUserId) {
        if (!userRepository.existsById(targetUserId)) {
            throw new NotFoundException("User not found: " + targetUserId);
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);

        // يجب أن يكون لـ target عضوية فعّالة في قسم يقع ضمن صلاحية actor.
        var targetMemberships = membershipRepo.findByUserIdAndActiveTrue(targetUserId);
        if (targetMemberships.isEmpty()) {
            throw new BadRequestException("TARGET_HAS_NO_DEPARTMENT", "Target user has no active department membership");
        }
        boolean anyAllowed = targetMemberships.stream().anyMatch(m ->
                m.getDepartmentId() != null
                && authorizationService.canManageCourtAccess(actor, m.getBranchId(), m.getDepartmentId()));
        if (!anyAllowed) throw new ForbiddenException("Not allowed to manage this user's court access");

        // تحقق أن كل محكمة موجودة وضمن نفس فرع target الذي يديره actor.
        Set<Long> allowedBranches = new HashSet<>();
        for (var m : targetMemberships) {
            if (m.getDepartmentId() != null
                    && authorizationService.canManageCourtAccess(actor, m.getBranchId(), m.getDepartmentId())) {
                allowedBranches.add(m.getBranchId());
            }
        }

        for (var entry : req.entries()) {
            Court court = courtRepository.findById(entry.courtId())
                    .orElseThrow(() -> new NotFoundException("Court not found: " + entry.courtId()));
            if (!allowedBranches.contains(court.getBranchId())) {
                throw new ForbiddenException("Court " + court.getId() + " is outside actor scope");
            }
            var existing = courtAccessRepo.findByUserIdAndCourtId(targetUserId, court.getId());
            if (existing.isPresent()) {
                var uca = existing.get();
                uca.setActive(entry.active());
                uca.setGrantedByUserId(actorUserId);
                uca.setGrantedAt(Instant.now());
            } else {
                courtAccessRepo.save(UserCourtAccess.builder()
                        .userId(targetUserId)
                        .courtId(court.getId())
                        .grantedByUserId(actorUserId)
                        .grantedAt(Instant.now())
                        .active(entry.active())
                        .build());
            }
        }

        return courtAccessRepo.findByUserId(targetUserId).stream()
                .map(uca -> new CourtAccessDto(uca.getId(), uca.getUserId(), uca.getCourtId(),
                        uca.getGrantedByUserId(), uca.getGrantedAt(), uca.isActive()))
                .toList();
    }

    public List<DelegatedPermissionDto> updateDelegatedPermissions(Long targetUserId,
                                                                    UpdateDelegatedPermissionsRequest req,
                                                                    Long actorUserId) {
        if (!userRepository.existsById(targetUserId)) {
            throw new NotFoundException("User not found: " + targetUserId);
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);

        var targetMemberships = membershipRepo.findByUserIdAndActiveTrue(targetUserId);
        if (targetMemberships.isEmpty()) {
            throw new BadRequestException("TARGET_HAS_NO_DEPARTMENT", "Target user has no active department membership");
        }
        // التفويض مخصص للموظف الإداري (ADMIN_CLERK) في نفس قسم actor (D-004).
        boolean targetIsClerkInActorScope = targetMemberships.stream().anyMatch(m ->
                m.getMembershipType() == MembershipType.ADMIN_CLERK
                        && m.getDepartmentId() != null
                        && actor.isSectionHeadOf(m.getBranchId(), m.getDepartmentId()));
        if (!targetIsClerkInActorScope) {
            throw new ForbiddenException("Delegations can only be set by the department's section head on its admin clerk");
        }

        for (var entry : req.entries()) {
            var existing = delegatedRepo.findByUserIdAndPermissionCode(targetUserId, entry.code());
            if (existing.isPresent()) {
                var p = existing.get();
                p.setGranted(entry.granted());
                p.setGrantedByUserId(actorUserId);
                p.setGrantedAt(Instant.now());
            } else {
                delegatedRepo.save(UserDelegatedPermission.builder()
                        .userId(targetUserId)
                        .permissionCode(entry.code())
                        .granted(entry.granted())
                        .grantedByUserId(actorUserId)
                        .grantedAt(Instant.now())
                        .build());
            }
        }

        return delegatedRepo.findByUserId(targetUserId).stream()
                .map(p -> new DelegatedPermissionDto(p.getId(), p.getUserId(), p.getPermissionCode(),
                        p.isGranted(), p.getGrantedByUserId(), p.getGrantedAt()))
                .toList();
    }
}

