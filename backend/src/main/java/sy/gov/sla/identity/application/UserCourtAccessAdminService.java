package sy.gov.sla.identity.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.api.CourtAccessDto;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.UserCourtAccess;
import sy.gov.sla.access.infrastructure.UserCourtAccessRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ConflictException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.identity.api.AddCourtAccessRequest;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.domain.Court;
import sy.gov.sla.organization.infrastructure.CourtRepository;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Mini-Phase B — manage court access of a user, granular shape.
 *
 * <p>Adds the missing per-row endpoints alongside the existing bulk
 * {@code PUT /api/v1/users/{id}/court-access} (kept untouched).</p>
 *
 * <p>Authorization mirrors {@code AccessControlService.updateCourtAccess}:
 * the actor must have {@code SECTION_HEAD} (or
 * {@code ADMIN_CLERK + MANAGE_COURT_ACCESS}) over a department where the
 * target user has an active membership; the court must belong to a branch
 * the actor manages for that user.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserCourtAccessAdminService {

    private final UserRepository userRepository;
    private final UserCourtAccessRepository courtAccessRepo;
    private final UserDepartmentMembershipRepository membershipRepo;
    private final CourtRepository courtRepository;
    private final AuthorizationService authorizationService;

    public CourtAccessDto add(Long userId, AddCourtAccessRequest req, Long actorUserId) {
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        Set<Long> allowedBranches = computeAllowedBranches(userId, actor);
        if (allowedBranches.isEmpty() && !actor.isCentralSupervisor()) {
            throw new ForbiddenException("Not allowed to manage this user's court access");
        }

        Court court = courtRepository.findById(req.courtId())
                .orElseThrow(() -> new BadRequestException("INVALID_COURT",
                        "Court not found: " + req.courtId()));
        if (!actor.isCentralSupervisor() && !allowedBranches.contains(court.getBranchId())) {
            throw new ForbiddenException("COURT_OUTSIDE_SCOPE",
                    "Court " + court.getId() + " is outside actor scope");
        }

        var existing = courtAccessRepo.findByUserIdAndCourtId(userId, court.getId());
        if (existing.isPresent()) {
            UserCourtAccess uca = existing.get();
            if (uca.isActive()) {
                throw new ConflictException("COURT_ACCESS_DUPLICATE",
                        "Court access already granted and active");
            }
            // re-activate
            uca.setActive(true);
            uca.setGrantedByUserId(actorUserId);
            uca.setGrantedAt(Instant.now());
            return toDto(uca);
        }
        UserCourtAccess saved = courtAccessRepo.save(UserCourtAccess.builder()
                .userId(userId)
                .courtId(court.getId())
                .grantedByUserId(actorUserId)
                .grantedAt(Instant.now())
                .active(true)
                .build());
        return toDto(saved);
    }

    /** Logical-delete: set active=false to preserve audit trail. */
    public void remove(Long userId, Long courtAccessId, Long actorUserId) {
        UserCourtAccess uca = courtAccessRepo.findById(courtAccessId)
                .orElseThrow(() -> new NotFoundException("Court access not found: " + courtAccessId));
        if (!uca.getUserId().equals(userId)) {
            throw new NotFoundException("Court access not found for user " + userId);
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        if (!actor.isCentralSupervisor()) {
            Set<Long> allowedBranches = computeAllowedBranches(userId, actor);
            Court court = courtRepository.findById(uca.getCourtId())
                    .orElseThrow(() -> new NotFoundException("Court not found: " + uca.getCourtId()));
            if (!allowedBranches.contains(court.getBranchId())) {
                throw new ForbiddenException("COURT_OUTSIDE_SCOPE",
                        "Court is outside actor scope");
            }
        }
        uca.setActive(false);
        uca.setGrantedByUserId(actorUserId);
        uca.setGrantedAt(Instant.now());
    }

    private Set<Long> computeAllowedBranches(Long targetUserId, AuthorizationContext actor) {
        Set<Long> allowed = new HashSet<>();
        for (var m : membershipRepo.findByUserIdAndActiveTrue(targetUserId)) {
            if (m.getDepartmentId() == null) continue;
            // NOTE: must use the boolean variant — calling the throwing variant inside
            // the same Spring-managed transaction marks the transaction as rollback-only
            // even when the ForbiddenException is caught here, causing the later commit
            // to fail with UnexpectedRollbackException → 500 INTERNAL_ERROR.
            if (authorizationService.canManageCourtAccess(actor, m.getBranchId(), m.getDepartmentId())) {
                allowed.add(m.getBranchId());
            }
        }
        return allowed;
    }

    private CourtAccessDto toDto(UserCourtAccess uca) {
        return new CourtAccessDto(uca.getId(), uca.getUserId(), uca.getCourtId(),
                uca.getGrantedByUserId(), uca.getGrantedAt(), uca.isActive());
    }
}


