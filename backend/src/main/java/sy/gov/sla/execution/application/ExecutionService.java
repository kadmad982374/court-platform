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
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.execution.api.AddExecutionStepRequest;
import sy.gov.sla.execution.api.ExecutionFileDto;
import sy.gov.sla.execution.api.ExecutionStepDto;
import sy.gov.sla.execution.api.PromoteToExecutionRequest;
import sy.gov.sla.execution.domain.ExecutionFile;
import sy.gov.sla.execution.domain.ExecutionFileStatus;
import sy.gov.sla.execution.domain.ExecutionStep;
import sy.gov.sla.execution.infrastructure.ExecutionFileRepository;
import sy.gov.sla.execution.infrastructure.ExecutionStepRepository;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.application.CaseStagePort.CaseAndCurrentStage;
import sy.gov.sla.litigationregistration.application.CaseStagePort.CaseBasisLabel;
import sy.gov.sla.litigationregistration.application.CaseStagePort.PromoteToExecutionResult;
import sy.gov.sla.litigationregistration.domain.LifecycleStatus;
import sy.gov.sla.litigationregistration.domain.StageStatus;
import sy.gov.sla.organization.application.OrganizationService;
import sy.gov.sla.organization.domain.Department;
import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepo;
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

        // PR-8 (C-4): include the destination execution dept's (branchId, departmentId)
        // so the notification listener can reach its SECTION_HEAD + ADMIN_CLERK without
        // a follow-up lookup.
        events.publishEvent(new CasePromotedToExecutionEvent(
                res.caseId(), res.sourceStageId(), ef.getId(),
                ef.getBranchId(), ef.getDepartmentId(),
                actorUserId, now));

        UserActionLog.action("promoted case #{} to execution — execution file #{}", res.caseId(), ef.getId());

        return toDto(ef);
    }

    // ========== Read: list + get ==========

    @Transactional(readOnly = true)
    public List<ExecutionFileDto> listFiles(Long branchId, Long departmentId, Long courtId,
                                            ExecutionFileStatus status, Integer year,
                                            int page, int size, Long actorUserId) {
        if (size <= 0) size = 20;
        if (size > 100) size = 100;
        if (page < 0) page = 0;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        // Customer feedback round-3: a section head whose section is NOT
        // EXECUTION must get a clear "no permission" response — not a silent
        // empty list. Block before building the scope/spec.
        requireExecutionAccess(ctx);
        ExecutionScope scope = ExecutionScope.from(ctx);

        // PR-12 (customer feedback E-2 / Q-A): "region" = court. Cross-module
        // hop via the port (D-023) — empty result short-circuits to no rows.
        final Set<Long> courtCaseIds = courtId == null
                ? null
                : caseStagePort.findCaseIdsByCourtId(courtId);

        Specification<ExecutionFile> spec = (root, q, cb) -> {
            List<Predicate> ands = new ArrayList<>();
            if (branchId != null)     ands.add(cb.equal(root.get("branchId"), branchId));
            if (departmentId != null) ands.add(cb.equal(root.get("departmentId"), departmentId));
            if (status != null)       ands.add(cb.equal(root.get("status"), status));
            if (year != null)         ands.add(cb.equal(root.get("executionYear"), year));
            if (courtCaseIds != null) {
                if (courtCaseIds.isEmpty()) ands.add(cb.disjunction());
                else ands.add(root.get("litigationCaseId").in(courtCaseIds));
            }
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
        requireFileReadAccess(ef, ctx);
        return toDto(ef);
    }

    private void requireFileReadAccess(ExecutionFile ef, AuthorizationContext ctx) {
        // Customer feedback round-3: deny upfront for users with no execution
        // path at all (e.g. SECTION_HEAD of FIRST_INSTANCE) so the message is
        // explicit rather than a generic "outside scope".
        requireExecutionAccess(ctx);
        ExecutionScope scope = ExecutionScope.from(ctx);
        if (scope.matches(ef.getBranchId(), ef.getDepartmentId(), ef.getAssignedUserId())) return;
        var caseInfo = caseStagePort.findCaseWithCurrentStage(ef.getLitigationCaseId()).orElse(null);
        if (caseInfo != null && authorizationService.canReadCase(ctx,
                caseInfo.branchId(), caseInfo.departmentId(), caseInfo.currentOwnerUserId())) return;
        throw new ForbiddenException("Execution file is outside actor read scope");
    }

    /**
     * Customer feedback round-3 — explicit execution-area gate.
     *
     * Allowed:
     *  - Supervisors (CENTRAL / READ_ONLY / SPECIAL).
     *  - BRANCH_HEAD (sees the branch's execution files).
     *  - SECTION_HEAD / ADMIN_CLERK whose membership lives in a department
     *    of type EXECUTION.
     *  - STATE_LAWYER (sees files where assigned_user_id == self).
     *
     * Otherwise throws {@code NO_EXECUTION_ACCESS} so the frontend can show
     * the Arabic "ليس لديك صلاحية لاستعراض ملفات التنفيذ" message instead of
     * a misleading empty list.
     */
    private void requireExecutionAccess(AuthorizationContext ctx) {
        if (ctx.isCentralSupervisor() || ctx.isReadOnlySupervisor() || ctx.isSpecialInspector()) return;
        if (!ctx.headOfBranches().isEmpty()) return;
        if (ctx.isStateLawyer()) return;
        var execDeptIds = ctx.departmentMemberships().stream()
                .filter(m -> m.active() && m.departmentId() != null)
                .map(m -> m.departmentId())
                .distinct()
                .toList();
        if (!execDeptIds.isEmpty()) {
            for (Department d : departmentRepo.findAllById(execDeptIds)) {
                if (d.getType() == DepartmentType.EXECUTION) return;
            }
        }
        throw new ForbiddenException("NO_EXECUTION_ACCESS",
                "ليس لديك صلاحية لاستعراض ملفات التنفيذ");
    }

    // ========== Steps: add (append-only) + list ==========

    public ExecutionStepDto addStep(Long executionFileId, AddExecutionStepRequest req, Long actorUserId) {
        ExecutionFile ef = fileRepo.findById(executionFileId)
                .orElseThrow(() -> new NotFoundException("Execution file not found: " + executionFileId));
        // PR-12 (customer feedback Q-E, stricter than the original D-2 default):
        // ADMIN_CLERK is now banned from execution steps regardless of any
        // ADD_EXECUTION_STEP delegation. SECTION_HEAD/BRANCH_HEAD never had a
        // path. Only the user assigned to the execution file (the lawyer) may
        // append. See Phase-5 ownership note (D-032).
        boolean assignedActor = ef.getAssignedUserId() != null
                && ef.getAssignedUserId().equals(actorUserId);
        if (!assignedActor) {
            throw new ForbiddenException("Only the user assigned to this execution file may add steps");
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

        UserActionLog.action("added execution step to file #{} — type={}, date={}",
                ef.getId(), step.getStepType(), step.getStepDate());

        return toStepDto(step);
    }

    /**
     * PR-12 (customer feedback C-7 / D-2): step-level visibility is narrower
     * than file-level. Managers (BRANCH_HEAD / SECTION_HEAD / ADMIN_CLERK) see
     * only the file row — never the step timeline. Read-paths allowed:
     *  - the user assigned to the execution file (the lawyer working it),
     *  - central / read-only / special-inspector supervisors (oversight).
     * Anyone else with file-row access still gets 403 here.
     */
    @Transactional(readOnly = true)
    public List<ExecutionStepDto> listSteps(Long executionFileId, Long actorUserId) {
        ExecutionFile ef = fileRepo.findById(executionFileId)
                .orElseThrow(() -> new NotFoundException("Execution file not found: " + executionFileId));
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        boolean assigned = ef.getAssignedUserId() != null
                && ef.getAssignedUserId().equals(actorUserId);
        boolean supervisor = ctx.isCentralSupervisor()
                || ctx.isReadOnlySupervisor()
                || ctx.isSpecialInspector();
        if (!assigned && !supervisor) {
            throw new ForbiddenException("Step-level activity is restricted to the assigned user");
        }
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

    private ExecutionFileDto toDto(ExecutionFile ef) {
        String branchNameAr = organizationService.findBranchById(ef.getBranchId())
                .map(b -> b.nameAr()).orElse(null);
        String departmentNameAr = organizationService.findDepartmentById(ef.getDepartmentId())
                .map(d -> d.nameAr()).orElse(null);
        String assignedUserFullName = ef.getAssignedUserId() == null ? null
                : userRepository.findById(ef.getAssignedUserId())
                        .map(u -> u.getFullName()).orElse(null);
        CaseBasisLabel basis = caseStagePort.findCaseBasisLabel(ef.getLitigationCaseId()).orElse(null);
        return new ExecutionFileDto(
                ef.getId(), ef.getLitigationCaseId(), ef.getSourceStageId(),
                ef.getEnforcingEntityName(), ef.getExecutedAgainstName(),
                ef.getExecutionFileType(), ef.getExecutionFileNumber(), ef.getExecutionYear(),
                ef.getBranchId(), ef.getDepartmentId(), ef.getAssignedUserId(),
                ef.getStatus(), ef.getCreatedByUserId(), ef.getCreatedAt(), ef.getUpdatedAt(),
                branchNameAr, departmentNameAr, assignedUserFullName,
                basis == null ? null : basis.basisNumber(),
                basis == null ? null : basis.basisYear());
    }

    private ExecutionStepDto toStepDto(ExecutionStep s) {
        return new ExecutionStepDto(
                s.getId(), s.getExecutionFileId(), s.getStepDate(),
                s.getStepType(), s.getStepDescription(),
                s.getCreatedByUserId(), s.getCreatedAt());
    }
}

