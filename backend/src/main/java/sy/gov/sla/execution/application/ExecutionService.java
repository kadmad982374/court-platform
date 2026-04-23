package sy.gov.sla.execution.application;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.DelegatedPermissionCode;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ConflictException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.execution.api.AddExecutionStepRequest;
import sy.gov.sla.execution.api.ExecutionFileDto;
import sy.gov.sla.execution.api.ExecutionStepDto;
import sy.gov.sla.execution.api.PromoteToExecutionRequest;
import sy.gov.sla.execution.domain.ExecutionFile;
import sy.gov.sla.execution.domain.ExecutionFileStatus;
import sy.gov.sla.execution.domain.ExecutionStep;
import sy.gov.sla.execution.infrastructure.ExecutionFileRepository;
import sy.gov.sla.execution.infrastructure.ExecutionStepRepository;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.application.CaseStagePort.CaseAndCurrentStage;
import sy.gov.sla.litigationregistration.application.CaseStagePort.PromoteToExecutionResult;
import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.organization.application.OrganizationService;
import sy.gov.sla.organization.domain.DepartmentType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Orchestration للمسار التنفيذي. مرجع: D-028..D-034 (Phase 5).
 *
 * مسؤوليات:
 *  - promote-to-execution (تحقق + استدعاء port الكتابة الذرية + إنشاء ExecutionFile + نشر حدث).
 *  - listExecutionFiles / getExecutionFile مع احترام Read scope (D-032).
 *  - addStep / listSteps مع احترام append-only (D-031) والصلاحيات (D-030).
 *
 * لا يلمس HearingProgressionEntry بتاتًا، ولا يُنشئ CaseStage جديدة (D-003).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ExecutionService {

    private final ExecutionFileRepository fileRepo;
    private final ExecutionStepRepository stepRepo;
    private final CaseStagePort caseStagePort;
    private final AuthorizationService authorizationService;
    private final OrganizationService organizationService;
    private final ApplicationEventPublisher events;

    // ========== Promote-to-execution ==========

    public ExecutionFileDto promoteCaseToExecution(Long caseId, PromoteToExecutionRequest req,
                                                   Long actorUserId) {
        // 1) تحميل الدعوى ومرحلتها الحالية.
        CaseAndCurrentStage info = caseStagePort.findCaseWithCurrentStage(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));

        // 2) صلاحية الترقية (D-030): SECTION_HEAD أو ADMIN_CLERK مع PROMOTE_TO_EXECUTION.
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireCaseManagement(actor, info.branchId(), info.departmentId(),
                DelegatedPermissionCode.PROMOTE_TO_EXECUTION);

        // 3) قواعد الترقية (D-029) — قائمة محافِظة بدون افتراض جديد على decisionType.
        if (info.currentStageStatus() != StageStatus.FINALIZED) {
            throw new BadRequestException("STAGE_NOT_FINALIZED",
                    "Current stage must be FINALIZED before promoting to execution");
        }
        if (info.currentStageReadOnly()) {
            throw new ConflictException("STAGE_ALREADY_PROMOTED",
                    "Current stage is read-only (already promoted)");
        }
        LifecycleStatus lc = info.lifecycleStatus();
        if (lc != LifecycleStatus.ACTIVE && lc != LifecycleStatus.IN_APPEAL) {
            throw new ConflictException("INVALID_LIFECYCLE_FOR_EXECUTION",
                    "Case lifecycle does not allow promote-to-execution: " + lc);
        }

        // 4) التحقق من تفرّد رقم الملف (branch + year + number) — D-029.
        if (fileRepo.existsByBranchIdAndExecutionYearAndExecutionFileNumber(
                info.branchId(), req.executionYear(), req.executionFileNumber())) {
            throw new ConflictException("EXECUTION_FILE_NUMBER_DUPLICATE",
                    "Execution file (branch, year, number) already exists");
        }

        // 5) تحديد قسم EXECUTION ضمن نفس فرع الدعوى — D-033.
        Long executionDepartmentId = organizationService
                .findDepartment(info.branchId(), DepartmentType.EXECUTION)
                .orElseThrow(() -> new ConflictException("NO_EXECUTION_DEPARTMENT_IN_BRANCH",
                        "Branch has no EXECUTION department configured"))
                .id();

        // 6) كتابة ذرّية على CaseStage/LitigationCase (D-034).
        PromoteToExecutionResult res = caseStagePort.promoteCurrentStageToExecution(caseId, actorUserId);

        // 7) إنشاء ExecutionFile.
        Instant now = Instant.now();
        ExecutionFile ef = ExecutionFile.builder()
                .litigationCaseId(res.caseId())
                .sourceStageId(res.sourceStageId())
                .enforcingEntityName(req.enforcingEntityName())
                .executedAgainstName(req.executedAgainstName())
                .executionFileType(req.executionFileType())
                .executionFileNumber(req.executionFileNumber())
                .executionYear(req.executionYear())
                .branchId(info.branchId())
                .departmentId(executionDepartmentId)
                // المُسنَد المبدئي = ownership المرحلة المُرَقَّاة (المحامي السابق إن وُجد) — D-032.
                .assignedUserId(res.previousOwnerUserId())
                .status(ExecutionFileStatus.OPEN)
                .createdByUserId(actorUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        ef = fileRepo.save(ef);

        events.publishEvent(new CasePromotedToExecutionEvent(
                res.caseId(), res.sourceStageId(), ef.getId(), actorUserId, now));

        return toDto(ef);
    }

    // ========== Read: list + get ==========

    @Transactional(readOnly = true)
    public List<ExecutionFileDto> listFiles(Long branchId, Long departmentId,
                                            ExecutionFileStatus status, Integer year,
                                            int page, int size, Long actorUserId) {
        if (size <= 0) size = 20;
        if (size > 100) size = 100;
        if (page < 0) page = 0;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        ExecutionScope scope = ExecutionScope.from(ctx);

        Specification<ExecutionFile> spec = (root, q, cb) -> {
            List<Predicate> ands = new ArrayList<>();
            if (branchId != null)     ands.add(cb.equal(root.get("branchId"), branchId));
            if (departmentId != null) ands.add(cb.equal(root.get("departmentId"), departmentId));
            if (status != null)       ands.add(cb.equal(root.get("status"), status));
            if (year != null)         ands.add(cb.equal(root.get("executionYear"), year));
            switch (scope.kind()) {
                case ALL -> { /* لا قيد إضافي */ }
                case BRANCHES -> {
                    if (scope.branchIds().isEmpty()) ands.add(cb.disjunction());
                    else ands.add(root.get("branchId").in(scope.branchIds()));
                }
                case BRANCH_DEPT_PAIRS -> {
                    if (scope.branchDeptKeys().isEmpty()) ands.add(cb.disjunction());
                    else {
                        List<Predicate> ors = new ArrayList<>();
                        for (Long key : scope.branchDeptKeys()) {
                            long b = key / 1_000_000L;
                            long d = key % 1_000_000L;
                            ors.add(cb.and(
                                    cb.equal(root.get("branchId"), b),
                                    cb.equal(root.get("departmentId"), d)));
                        }
                        ands.add(cb.or(ors.toArray(new Predicate[0])));
                    }
                }
                case ASSIGNED_USER -> ands.add(cb.equal(root.get("assignedUserId"), scope.assignedUserId()));
                case NONE -> ands.add(cb.disjunction());
            }
            return cb.and(ands.toArray(new Predicate[0]));
        };

        return fileRepo.findAll(spec, pageable).getContent().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ExecutionFileDto getFile(Long executionFileId, Long actorUserId) {
        ExecutionFile ef = fileRepo.findById(executionFileId)
                .orElseThrow(() -> new NotFoundException("Execution file not found: " + executionFileId));
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        ExecutionScope scope = ExecutionScope.from(ctx);
        if (scope.matches(ef.getBranchId(), ef.getDepartmentId(), ef.getAssignedUserId())) return;
        var caseInfo = caseStagePort.findCaseWithCurrentStage(ef.getLitigationCaseId()).orElse(null);
        if (caseInfo != null && authorizationService.canReadCase(ctx,
                caseInfo.branchId(), caseInfo.departmentId(), caseInfo.currentOwnerUserId())) return;
        throw new ForbiddenException("Execution file is outside actor read scope");
    }

    // ========== Steps: add (append-only) + list ==========

        if (!scope.matches(ef.getBranchId(), ef.getDepartmentId(), ef.getAssignedUserId())) {
            throw new ForbiddenException("Execution file is outside actor read scope");
        }
        return toDto(ef);
        //  - assigned_user_id == actor (المحامي/الموظف المُسنَد للملف).
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        boolean assignedActor = ef.getAssignedUserId() != null
                && ef.getAssignedUserId().equals(actorUserId);
        if (!assignedActor) {
            authorizationService.requireCaseManagement(ctx, ef.getBranchId(), ef.getDepartmentId(),
                    DelegatedPermissionCode.ADD_EXECUTION_STEP);
        }

        Instant now = Instant.now();
        ExecutionStep step = ExecutionStep.builder()
                .executionFileId(ef.getId())
                .stepDate(req.stepDate())
                .stepType(req.stepType())
                .stepDescription(req.stepDescription())
                .createdByUserId(actorUserId)
                .createdAt(now)
                .build();
        step = stepRepo.save(step);

        ef.setUpdatedAt(now);

        events.publishEvent(new ExecutionStepAddedEvent(
                ef.getId(), step.getId(), step.getStepType(), actorUserId, now));

        return toStepDto(step);
    }

    @Transactional(readOnly = true)
    public List<ExecutionStepDto> listSteps(Long executionFileId, Long actorUserId) {
        ExecutionFile ef = fileRepo.findById(executionFileId)
                .orElseThrow(() -> new NotFoundException("Execution file not found: " + executionFileId));
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        requireFileReadAccess(ef, ctx);
        return stepRepo.findByExecutionFileIdOrderByStepDateAscIdAsc(executionFileId)
                .stream().map(this::toStepDto).toList();
    }

    /**
     * يُرجع ExecutionFile الأب لـ stepId مع تطبيق read-scope على الملف.
     * يُستخدم خارج الوحدة (مثلاً attachments) لاحترام D-023 — لا وصول مباشر للـ repo.
     */
    @Transactional(readOnly = true)
    public ExecutionFileDto getFileForStep(Long stepId, Long actorUserId) {
        ExecutionStep step = stepRepo.findById(stepId)
                .orElseThrow(() -> new NotFoundException("Execution step not found: " + stepId));
        return getFile(step.getExecutionFileId(), actorUserId);
    }

    // ========== Mapping ==========

        ExecutionScope scope = ExecutionScope.from(ctx);
        if (!scope.matches(ef.getBranchId(), ef.getDepartmentId(), ef.getAssignedUserId())) {
            throw new ForbiddenException("Execution file is outside actor read scope");
        }
        return new ExecutionFileDto(
                ef.getId(), ef.getLitigationCaseId(), ef.getSourceStageId(),
                ef.getEnforcingEntityName(), ef.getExecutedAgainstName(),
                ef.getExecutionFileType(), ef.getExecutionFileNumber(), ef.getExecutionYear(),
                ef.getBranchId(), ef.getDepartmentId(), ef.getAssignedUserId(),
                ef.getStatus(), ef.getCreatedByUserId(), ef.getCreatedAt(), ef.getUpdatedAt());
    }

    private ExecutionStepDto toStepDto(ExecutionStep s) {
        return new ExecutionStepDto(
                s.getId(), s.getExecutionFileId(), s.getStepDate(),
                s.getStepType(), s.getStepDescription(),
                s.getCreatedByUserId(), s.getCreatedAt());
    }
}

