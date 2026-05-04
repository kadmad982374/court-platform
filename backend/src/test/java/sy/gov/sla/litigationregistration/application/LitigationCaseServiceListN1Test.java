package sy.gov.sla.litigationregistration.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.litigationregistration.api.PageResponse;
import sy.gov.sla.litigationregistration.domain.CaseStage;
import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.LitigationCase;
import sy.gov.sla.litigationregistration.domain.PublicEntityPosition;
import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.litigationregistration.domain.StageType;
import sy.gov.sla.litigationregistration.infrastructure.CaseStageRepository;
import sy.gov.sla.litigationregistration.infrastructure.LitigationCaseRepository;
import sy.gov.sla.organization.application.OrganizationService;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P3-01 regression guard — proves {@code listCases} batches stage lookups via
 * {@code findByLitigationCaseIdIn(ids)} and never falls back to the per-row
 * {@code findByLitigationCaseId(id)} path that produced the original N+1.
 *
 * Pure Mockito (no Spring/DB) so the test is fast and deterministic.
 */
@ExtendWith(MockitoExtension.class)
class LitigationCaseServiceListN1Test {

    @Mock private LitigationCaseRepository caseRepo;
    @Mock private CaseStageRepository stageRepo;
    @Mock private OrganizationService organizationService;
    @Mock private AuthorizationService authorizationService;
    @Mock private ApplicationEventPublisher events;

    @InjectMocks private LitigationCaseService service;

    private static AuthorizationContext centralCtx() {
        return new AuthorizationContext(
                /* userId */ 1L,
                Set.of(RoleType.CENTRAL_SUPERVISOR),
                Set.of(),
                Set.of(),
                Set.of());
    }

    private static LitigationCase litCase(Long id) {
        return LitigationCase.builder()
                .id(id)
                .publicEntityName("entity-" + id)
                .publicEntityPosition(PublicEntityPosition.PLAINTIFF)
                .opponentName("opp-" + id)
                .originalBasisNumber(String.valueOf(id))
                .basisYear(2026)
                .originalRegistrationDate(LocalDate.of(2026, 1, 1))
                .createdBranchId(10L)
                .createdDepartmentId(20L)
                .createdCourtId(30L)
                .lifecycleStatus(LifecycleStatus.ACTIVE)
                .createdByUserId(1L)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private static CaseStage stage(Long id, Long caseId) {
        return CaseStage.builder()
                .id(id)
                .litigationCaseId(caseId)
                .stageType(StageType.FIRST_INSTANCE)
                .branchId(10L)
                .departmentId(20L)
                .courtId(30L)
                .stageBasisNumber(String.valueOf(id))
                .stageYear(2026)
                .stageStatus(StageStatus.REGISTERED)
                .readOnly(false)
                .firstHearingDate(LocalDate.of(2026, 2, 1))
                .firstPostponementReason("reason")
                .startedAt(Instant.now())
                .build();
    }

    @Test
    void listCases_with_3_results_calls_findByLitigationCaseIdIn_exactly_once() {
        when(authorizationService.loadContext(anyLong())).thenReturn(centralCtx());

        Page<LitigationCase> page = new PageImpl<>(
                List.of(litCase(1L), litCase(2L), litCase(3L)),
                PageRequest.of(0, 20),
                3);
        when(caseRepo.findAll(any(Specification.class), any(Pageable.class))).thenReturn(page);
        when(stageRepo.findByLitigationCaseIdIn(eq(List.of(1L, 2L, 3L))))
                .thenReturn(List.of(stage(101L, 1L), stage(102L, 2L), stage(103L, 3L)));

        PageResponse<sy.gov.sla.litigationregistration.api.LitigationCaseDto> result =
                service.listCases(0, 20, /* actorUserId */ 99L);

        // The page is wrapped + each case got its stages attached.
        assertThat(result.content()).hasSize(3);
        assertThat(result.content().get(0).stages()).hasSize(1);

        // ===== The N+1 regression guard =====
        verify(stageRepo, times(1)).findByLitigationCaseIdIn(List.of(1L, 2L, 3L));
        verify(stageRepo, never()).findByLitigationCaseId(anyLong());
    }

    @Test
    void listCases_with_empty_page_skips_the_batch_call_entirely() {
        when(authorizationService.loadContext(anyLong())).thenReturn(centralCtx());
        Page<LitigationCase> empty = new PageImpl<>(List.of(), PageRequest.of(0, 20), 0);
        when(caseRepo.findAll(any(Specification.class), any(Pageable.class))).thenReturn(empty);

        service.listCases(0, 20, 99L);

        verify(stageRepo, never()).findByLitigationCaseIdIn(any());
        verify(stageRepo, never()).findByLitigationCaseId(anyLong());
    }
}
