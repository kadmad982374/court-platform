package sy.gov.sla.litigationregistration.application;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.DelegatedPermissionCode;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.litigationregistration.api.*;
import sy.gov.sla.litigationregistration.domain.*;
import sy.gov.sla.litigationregistration.infrastructure.CaseStageRepository;
import sy.gov.sla.litigationregistration.infrastructure.LitigationCaseRepository;
import sy.gov.sla.organization.application.OrganizationService;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class LitigationCaseService {

    private final LitigationCaseRepository caseRepo;
    private final CaseStageRepository stageRepo;
    private final OrganizationService organizationService;
    private final AuthorizationService authorizationService;
    private final ApplicationEventPublisher events;

    // ========== Create ==========

    public LitigationCaseDto createCase(CreateCaseRequest req, Long actorUserId) {
        // 1) تحقق من تكامل الفرع/القسم/المحكمة (BadRequest 400 عند الخلل).
        organizationService.validateConsistency(req.branchId(), req.departmentId(), req.courtId());

        // 2) صلاحيات: SECTION_HEAD، أو ADMIN_CLERK مع تفويض CREATE_CASE.
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireCaseManagement(actor, req.branchId(), req.departmentId(),
                DelegatedPermissionCode.CREATE_CASE);

        // 3) بناء كيان الملف الأصلي (currentStageId/currentOwner null حتى تنشأ المرحلة).
        Instant now = Instant.now();
        LitigationCase lc = LitigationCase.builder()
                .publicEntityName(req.publicEntityName())
                .publicEntityPosition(req.publicEntityPosition())
                .opponentName(req.opponentName())
                .originalBasisNumber(req.originalBasisNumber())
                .basisYear(req.basisYear())
                .originalRegistrationDate(req.originalRegistrationDate())
                .createdBranchId(req.branchId())
                .createdDepartmentId(req.departmentId())
                .createdCourtId(req.courtId())
                .chamberName(req.chamberName())
                .lifecycleStatus(LifecycleStatus.NEW)
                .createdByUserId(actorUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        lc = caseRepo.save(lc);

        // 4) إنشاء المرحلة الأولى.
        CaseStage stage = CaseStage.builder()
                .litigationCaseId(lc.getId())
                .stageType(req.stageType())
                .branchId(req.branchId())
                .departmentId(req.departmentId())
                .courtId(req.courtId())
                .chamberName(req.chamberName())
                .stageBasisNumber(req.stageBasisNumber())
                .stageYear(req.stageYear())
                .stageStatus(StageStatus.REGISTERED)
                .readOnly(false)
                .firstHearingDate(req.firstHearingDate())
                .firstPostponementReason(req.firstPostponementReason())
                .startedAt(now)
                .build();
        stage = stageRepo.save(stage);

        lc.setCurrentStageId(stage.getId());
        lc.setUpdatedAt(now);

        events.publishEvent(new CaseRegisteredEvent(
                lc.getId(), stage.getId(), lc.getCreatedBranchId(),
                lc.getCreatedDepartmentId(), lc.getCreatedCourtId(),
                actorUserId, null, now));

        return toDto(lc, List.of(stage));
    }

    // ========== Read ==========

    @Transactional(readOnly = true)
    public LitigationCaseDto getCase(Long caseId, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireReadAccessMultiScope(actor, lc);
        return toDto(lc, stageRepo.findByLitigationCaseId(caseId));
    }

    @Transactional(readOnly = true)
    public List<CaseStageDto> listStages(Long caseId, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireReadAccessMultiScope(actor, lc);
        return stageRepo.findByLitigationCaseId(caseId).stream().map(this::toStageDto).toList();
    }

    /**
     * Checks read access using multiple scopes:
     * 1. Standard check against the case's created department (covers section-head/clerk/branch-head/current-owner).
     * 2. Fallback to the current stage's department (e.g. APPEAL dept after promotion).
     * 3. STATE_LAWYER: also granted if they are the assignedLawyerUserId on ANY stage of the case
     *    (preserves read access for the FI lawyer after their stage is promoted, and grants access
     *    to the appeal lawyer once they are assigned to the appeal stage).
     *    A lawyer who is NOT assigned to any stage of this case is explicitly denied.
     */
    private void requireReadAccessMultiScope(AuthorizationContext actor, LitigationCase lc) {
        if (authorizationService.canReadCase(actor,
                lc.getCreatedBranchId(), lc.getCreatedDepartmentId(), lc.getCurrentOwnerUserId())) {
            return;
        }
        // Fallback: check against the current stage's branch/dept (e.g. APPEAL dept after promotion)
        if (lc.getCurrentStageId() != null) {
            CaseStage cur = stageRepo.findById(lc.getCurrentStageId()).orElse(null);
            if (cur != null && authorizationService.canReadCase(actor,
                    cur.getBranchId(), cur.getDepartmentId(), lc.getCurrentOwnerUserId())) {
                return;
            }
        }
        // STATE_LAWYER: allow only if personally assigned to at least one stage of this case.
        // This covers the FI lawyer after promotion (historical stage) and the appeal lawyer
        // once assigned to the appeal stage — but blocks any unassigned lawyer.
        if (actor.isStateLawyer()) {
            boolean assignedToAnyStage = stageRepo.findByLitigationCaseId(lc.getId())
                    .stream()
                    .anyMatch(s -> actor.userId().equals(s.getAssignedLawyerUserId()));
            if (assignedToAnyStage) return;
        }
        throw new ForbiddenException("Case is outside actor read scope");
    }

    @Transactional(readOnly = true)
    public PageResponse<LitigationCaseDto> listCases(int page, int size, Long actorUserId) {
        if (size <= 0) size = 20;
        if (size > 100) size = 100;
        if (page < 0) page = 0;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        Specification<LitigationCase> spec = buildScopeSpec(actor);

        Page<LitigationCase> p = (spec == null)
                ? Page.empty(pageable)
                : caseRepo.findAll(spec, pageable);

        List<LitigationCaseDto> content = p.getContent().stream()
                .map(lc -> toDto(lc, stageRepo.findByLitigationCaseId(lc.getId())))
                .toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }

    /** يبني Specification فلترة حسب نطاق الصلاحية — D-021. */
    private Specification<LitigationCase> buildScopeSpec(AuthorizationContext ctx) {
        if (ctx.isCentralSupervisor() || ctx.isReadOnlySupervisor() || ctx.isSpecialInspector()) {
            return (root, q, cb) -> cb.conjunction();
        }
        return (root, q, cb) -> {
            List<Predicate> ors = new ArrayList<>();
            // BRANCH_HEAD: فروعه.
            if (!ctx.headOfBranches().isEmpty()) {
                ors.add(root.get("createdBranchId").in(ctx.headOfBranches()));
            }
            // SECTION_HEAD / ADMIN_CLERK: عضوياته.
            for (var m : ctx.departmentMemberships()) {
                if (!m.active()) continue;
                if (m.type() == MembershipType.SECTION_HEAD || m.type() == MembershipType.ADMIN_CLERK) {
                    if (m.departmentId() == null) continue;
                    ors.add(cb.and(
                            cb.equal(root.get("createdBranchId"), m.branchId()),
                            cb.equal(root.get("createdDepartmentId"), m.departmentId())
                    ));
                }
            }
            // STATE_LAWYER: ملكيته.
            if (ctx.isStateLawyer()) {
                ors.add(cb.equal(root.get("currentOwnerUserId"), ctx.userId()));
            }
            if (ors.isEmpty()) {
                // لا أي مسار → نتيجة فارغة.
                return cb.disjunction();
            }
            return cb.or(ors.toArray(new Predicate[0]));
        };
    }

    // ========== Update basic data ==========

    public LitigationCaseDto updateBasicData(Long caseId, UpdateBasicDataRequest req, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));

        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireCaseManagement(actor, lc.getCreatedBranchId(),
                lc.getCreatedDepartmentId(), DelegatedPermissionCode.EDIT_CASE_BASIC_DATA);

        // المرحلة الحالية فقط (إن لم تكن read-only).
        CaseStage stage = lc.getCurrentStageId() == null ? null
                : stageRepo.findById(lc.getCurrentStageId()).orElse(null);
        if (stage != null && stage.isReadOnly()) {
            throw new BadRequestException("STAGE_READ_ONLY", "Current stage is read-only");
        }

        // تطبيق التحديثات (الحقول الممرَّرة فقط).
        if (req.publicEntityName() != null) lc.setPublicEntityName(req.publicEntityName());
        if (req.publicEntityPosition() != null) lc.setPublicEntityPosition(req.publicEntityPosition());
        if (req.opponentName() != null) lc.setOpponentName(req.opponentName());
        if (req.originalBasisNumber() != null) lc.setOriginalBasisNumber(req.originalBasisNumber());
        if (req.basisYear() != null) lc.setBasisYear(req.basisYear());
        if (req.chamberName() != null) lc.setChamberName(req.chamberName());

        if (req.courtId() != null && stage != null) {
            // المحكمة الجديدة يجب أن تبقى متسقة مع نفس الفرع/القسم.
            organizationService.validateConsistency(lc.getCreatedBranchId(),
                    lc.getCreatedDepartmentId(), req.courtId());
            lc.setCreatedCourtId(req.courtId());
            stage.setCourtId(req.courtId());
        }

        if (stage != null) {
            if (req.chamberName() != null) stage.setChamberName(req.chamberName());
            if (req.stageBasisNumber() != null) stage.setStageBasisNumber(req.stageBasisNumber());
            if (req.stageYear() != null) stage.setStageYear(req.stageYear());
            if (req.firstHearingDate() != null) stage.setFirstHearingDate(req.firstHearingDate());
            if (req.firstPostponementReason() != null)
                stage.setFirstPostponementReason(req.firstPostponementReason());
        }

        lc.setUpdatedAt(Instant.now());
        return toDto(lc, stageRepo.findByLitigationCaseId(caseId));
    }

    // ========== Assign lawyer ==========

    public LitigationCaseDto assignLawyer(Long caseId, AssignLawyerRequest req, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireCaseManagement(actor, lc.getCreatedBranchId(),
                lc.getCreatedDepartmentId(), DelegatedPermissionCode.ASSIGN_LAWYER);

        CaseStage stage = stageRepo.findById(lc.getCurrentStageId())
                .orElseThrow(() -> new BadRequestException("NO_CURRENT_STAGE", "Case has no current stage"));
        if (stage.isReadOnly()) {
            throw new BadRequestException("STAGE_READ_ONLY", "Current stage is read-only");
        }

        // المحامي يجب أن يكون STATE_LAWYER عضو في قسم المرحلة الحالية (لا قسم الإنشاء).
        // هذا يتيح تعيين محامي استئناف بعد الترقية إلى مرحلة الاستئناف.
        if (!authorizationService.isActiveMemberOf(req.lawyerUserId(),
                stage.getBranchId(), stage.getDepartmentId(), MembershipType.STATE_LAWYER)) {
            throw new ForbiddenException("Lawyer is not an active state lawyer in this department");
        }
        // ولديه UserCourtAccess فعّال على محكمة المرحلة الحالية.
        if (!authorizationService.hasCourtAccess(req.lawyerUserId(), stage.getCourtId())) {
            throw new ForbiddenException("Lawyer has no active access to the case court");
        }

        Instant now = Instant.now();
        stage.setAssignedLawyerUserId(req.lawyerUserId());
        stage.setStageStatus(StageStatus.ASSIGNED);
        lc.setCurrentOwnerUserId(req.lawyerUserId());
        lc.setLifecycleStatus(LifecycleStatus.ACTIVE);
        lc.setUpdatedAt(now);

        events.publishEvent(new LawyerAssignedEvent(
                lc.getId(), stage.getId(), req.lawyerUserId(), actorUserId, now));

        return toDto(lc, stageRepo.findByLitigationCaseId(caseId));
    }

    // ========== Mapping ==========

    private LitigationCaseDto toDto(LitigationCase lc, List<CaseStage> stages) {
        var stageDtos = stages.stream().map(this::toStageDto).toList();
        return new LitigationCaseDto(
                lc.getId(), lc.getPublicEntityName(), lc.getPublicEntityPosition(),
                lc.getOpponentName(), lc.getOriginalBasisNumber(), lc.getBasisYear(),
                lc.getOriginalRegistrationDate(), lc.getCreatedBranchId(),
                lc.getCreatedDepartmentId(), lc.getCreatedCourtId(), lc.getChamberName(),
                lc.getCurrentStageId(), lc.getCurrentOwnerUserId(), lc.getLifecycleStatus(),
                lc.getCreatedByUserId(), lc.getCreatedAt(), lc.getUpdatedAt(), stageDtos);
    }

    private CaseStageDto toStageDto(CaseStage s) {
        return new CaseStageDto(s.getId(), s.getLitigationCaseId(), s.getStageType(),
                s.getBranchId(), s.getDepartmentId(), s.getCourtId(), s.getChamberName(),
                s.getStageBasisNumber(), s.getStageYear(), s.getAssignedLawyerUserId(),
                s.getStageStatus(), s.getParentStageId(), s.isReadOnly(),
                s.getFirstHearingDate(), s.getFirstPostponementReason(),
                s.getStartedAt(), s.getEndedAt());
    }
}

