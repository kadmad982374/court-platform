package sy.gov.sla.litigationregistration.infrastructure;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import sy.gov.sla.access.application.CaseOwnershipPort;
import sy.gov.sla.litigationregistration.domain.LitigationCase;

import java.util.Optional;

/**
 * Adapter يُنفِّذ {@link CaseOwnershipPort} ويعزل access-control عن مستودع litigationregistration.
 */
@Component
@RequiredArgsConstructor
public class CaseOwnershipAdapter implements CaseOwnershipPort {

    private final LitigationCaseRepository repo;
    private final CaseStageRepository stageRepo;

    @Override
    public Optional<Long> findCurrentOwner(Long caseId) {
        return repo.findById(caseId).map(LitigationCase::getCurrentOwnerUserId);
    }

    @Override
    public Optional<CaseScope> findCaseScope(Long caseId) {
        return repo.findById(caseId)
                .map(c -> new CaseScope(c.getCreatedBranchId(), c.getCreatedDepartmentId(),
                        c.getCreatedCourtId(), c.getCurrentOwnerUserId()));
    }

    @Override
    public boolean isAssignedLawyerOfAnyStage(Long caseId, Long userId) {
        if (caseId == null || userId == null) return false;
        return stageRepo.findByLitigationCaseId(caseId).stream()
                .anyMatch(s -> userId.equals(s.getAssignedLawyerUserId()));
    }
}

