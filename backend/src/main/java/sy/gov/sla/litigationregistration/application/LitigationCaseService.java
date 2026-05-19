package sy.gov.sla.litigationregistration.application;

import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.DelegatedPermissionCode;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.decisionfinalization.domain.CaseDecision;
import sy.gov.sla.decisionfinalization.infrastructure.CaseDecisionRepository;
import sy.gov.sla.litigationregistration.api.*;
import sy.gov.sla.litigationregistration.domain.*;
import sy.gov.sla.litigationregistration.infrastructure.CaseStageRepository;
import sy.gov.sla.litigationregistration.infrastructure.LitigationCaseRepository;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.application.OrganizationService;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class LitigationCaseService {

    private final LitigationCaseRepository caseRepo;
    private final CaseStageRepository stageRepo;
    private final CaseDecisionRepository decisionRepo; // PR-11
    private final OrganizationService organizationService;
    private final AuthorizationService authorizationService;
    private final ApplicationEventPublisher events;
    private final UserRepository userRepo;
    private final JdbcTemplate jdbc;

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
                .courtType(req.courtType())
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
        // Seed denormalized last_hearing_date from the new stage's first hearing.
        lc.setLastHearingDate(stage.getFirstHearingDate());

        events.publishEvent(new CaseRegisteredEvent(
                lc.getId(), stage.getId(), lc.getCreatedBranchId(),
                lc.getCreatedDepartmentId(), lc.getCreatedCourtId(),
                actorUserId, null, now));

        UserActionLog.action("created case #{} — court={}, basis={}/{}, owner={}",
                lc.getId(), lc.getCreatedCourtId(), lc.getOriginalBasisNumber(), lc.getBasisYear(),
                lc.getCurrentOwnerUserId());

        return toDto(lc, List.of(stage));
    }

    // ========== Delete ==========

    /**
     * Customer feedback round-3 — hard-delete a case and everything that
     * hangs off it. Reserved to {@code CENTRAL_SUPERVISOR} (the platform
     * admin); any other actor receives 403.
     *
     * <p>Order matters because we don't have ON DELETE CASCADE on the FKs:
     * <ol>
     *   <li>break the case ↔ stage cycle by nulling {@code current_stage_id};</li>
     *   <li>delete attachments / steps / files / hearings / decisions that
     *       hang off the case's stages and execution files;</li>
     *   <li>delete reminders + notifications referencing the case;</li>
     *   <li>delete the stages, then the case row itself.</li>
     * </ol>
     */
    public void deleteCase(Long caseId, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));

        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        if (!actor.isCentralSupervisor()) {
            throw new ForbiddenException("ADMIN_ONLY",
                    "حذف الدعاوى متاح للمشرف المركزي فقط");
        }

        // 1) Break the case↔stage cycle so DELETE FROM case_stages is allowed.
        jdbc.update("UPDATE litigation_cases SET current_stage_id = NULL WHERE id = ?", caseId);

        // 2) Stage-scoped children (hearing entries, decisions, stage attachments).
        jdbc.update(
                "DELETE FROM hearing_progression_entries "
              + " WHERE case_stage_id IN (SELECT id FROM case_stages WHERE litigation_case_id = ?)",
                caseId);
        jdbc.update(
                "DELETE FROM case_decisions "
              + " WHERE case_stage_id IN (SELECT id FROM case_stages WHERE litigation_case_id = ?)",
                caseId);
        jdbc.update(
                "DELETE FROM attachments "
              + " WHERE attachment_scope_type = 'CASE_STAGE' "
              + "   AND scope_id IN (SELECT id FROM case_stages WHERE litigation_case_id = ?)",
                caseId);

        // 3) Execution side: steps (+ their attachments), file attachments, files.
        jdbc.update(
                "DELETE FROM attachments "
              + " WHERE attachment_scope_type = 'EXECUTION_STEP' "
              + "   AND scope_id IN ("
              + "       SELECT s.id FROM execution_steps s"
              + "         JOIN execution_files f ON f.id = s.execution_file_id"
              + "        WHERE f.litigation_case_id = ?)",
                caseId);
        jdbc.update(
                "DELETE FROM execution_steps "
              + " WHERE execution_file_id IN (SELECT id FROM execution_files WHERE litigation_case_id = ?)",
                caseId);
        jdbc.update(
                "DELETE FROM attachments "
              + " WHERE attachment_scope_type = 'EXECUTION_FILE' "
              + "   AND scope_id IN (SELECT id FROM execution_files WHERE litigation_case_id = ?)",
                caseId);
        jdbc.update("DELETE FROM execution_files WHERE litigation_case_id = ?", caseId);

        // 4) Reminders + case-targeted notifications.
        jdbc.update("DELETE FROM reminders WHERE litigation_case_id = ?", caseId);
        jdbc.update(
                "DELETE FROM notifications "
              + " WHERE related_entity_type = 'LITIGATION_CASE' AND related_entity_id = ?",
                caseId);

        // 5) Stages, then the case.
        jdbc.update("DELETE FROM case_stages WHERE litigation_case_id = ?", caseId);
        jdbc.update("DELETE FROM litigation_cases WHERE id = ?", caseId);

        UserActionLog.action("admin deleted case #{} (basis={}/{})",
                caseId, lc.getOriginalBasisNumber(), lc.getBasisYear());
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

    /**
     * PR-9 (customer feedback A-3 / B-1 / C-1 / D-1) — listCases now accepts
     * explicit filter params on top of the implicit role scope (D-021).
     * All filter params are optional. The role scope is ALWAYS applied first
     * (security invariant); explicit filters narrow further with AND.
     *
     * @param branchId      restrict to cases created in this branch
     * @param departmentId  restrict to cases created in this department
     * @param courtId       restrict to cases created in this court
     * @param q             free-text search; matches publicEntityName,
     *                      opponentName, or originalBasisNumber (case-insensitive
     *                      LIKE %q%)
     * @param hearingDate   restrict to cases that have a hearing on this exact
     *                      date — across any stage's first_hearing_date OR any
     *                      hearing_progression_entries.hearing_date.
     */
    @Transactional(readOnly = true)
    public PageResponse<LitigationCaseDto> listCases(int page, int size, Long actorUserId,
                                                     Long branchId, Long departmentId, Long courtId,
                                                     String q, LocalDate hearingDate) {
        if (size <= 0) size = 20;
        if (size > 100) size = 100;
        if (page < 0) page = 0;
        // Customer feedback: sort by hearing date DESC (newest first), NULLs last,
        // then createdAt DESC as a tiebreaker for cases with no hearings yet.
        Sort sort = Sort.by(
                new Sort.Order(Sort.Direction.DESC, "lastHearingDate", Sort.NullHandling.NULLS_LAST),
                new Sort.Order(Sort.Direction.DESC, "createdAt"));
        Pageable pageable = PageRequest.of(page, size, sort);

        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        Specification<LitigationCase> spec = buildScopeSpec(actor);
        Specification<LitigationCase> filter = buildFilterSpec(branchId, departmentId, courtId, q, hearingDate);
        if (spec != null && filter != null) {
            spec = spec.and(filter);
        } else if (filter != null) {
            spec = filter;
        }

        Page<LitigationCase> p = (spec == null)
                ? Page.empty(pageable)
                : caseRepo.findAll(spec, pageable);

        // P3-01: batch-load all stages for the page in ONE query, group by case.
        // Was N+1 (one findByLitigationCaseId per case). New shape:
        //   1 query for cases, 1 query for all their stages, in-memory groupBy.
        List<Long> caseIds = p.getContent().stream().map(LitigationCase::getId).toList();
        Map<Long, List<CaseStage>> stagesByCase = caseIds.isEmpty()
                ? Map.of()
                : stageRepo.findByLitigationCaseIdIn(caseIds).stream()
                    .collect(Collectors.groupingBy(CaseStage::getLitigationCaseId));

        List<LitigationCaseDto> content = p.getContent().stream()
                .map(lc -> toDto(lc, stagesByCase.getOrDefault(lc.getId(), List.of())))
                .toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }

    /**
     * PR-9 — explicit filter spec (branch/dept/court/q) applied on top of the
     * role scope. Returns null when nothing to filter, so the caller can skip
     * the {@code .and()}.
     */
    private Specification<LitigationCase> buildFilterSpec(Long branchId, Long departmentId,
                                                          Long courtId, String q,
                                                          LocalDate hearingDate) {
        boolean hasQ = q != null && !q.isBlank();
        if (branchId == null && departmentId == null && courtId == null
                && !hasQ && hearingDate == null) {
            return null;
        }
        return (root, query, cb) -> {
            List<Predicate> ands = new ArrayList<>();
            if (branchId != null) {
                ands.add(cb.equal(root.get("createdBranchId"), branchId));
            }
            if (departmentId != null) {
                ands.add(cb.equal(root.get("createdDepartmentId"), departmentId));
            }
            if (courtId != null) {
                ands.add(cb.equal(root.get("createdCourtId"), courtId));
            }
            if (hasQ) {
                String pattern = "%" + q.trim().toLowerCase() + "%";
                ands.add(cb.or(
                        cb.like(cb.lower(root.get("publicEntityName")), pattern),
                        cb.like(cb.lower(root.get("opponentName")), pattern),
                        cb.like(cb.lower(root.get("originalBasisNumber")), pattern)
                ));
            }
            if (hearingDate != null) {
                // EXISTS over stages with this firstHearingDate
                //   OR EXISTS over hearing_progression_entries with this hearing_date
                //      joined to a stage of this case.
                Subquery<Long> stageSub = query.subquery(Long.class);
                Root<sy.gov.sla.litigationregistration.domain.CaseStage> stageRoot = stageSub.from(
                        sy.gov.sla.litigationregistration.domain.CaseStage.class);
                stageSub.select(cb.literal(1L)).where(
                        cb.equal(stageRoot.get("litigationCaseId"), root.get("id")),
                        cb.equal(stageRoot.get("firstHearingDate"), hearingDate));

                Subquery<Long> entrySub = query.subquery(Long.class);
                Root<sy.gov.sla.litigationprogression.domain.HearingProgressionEntry> entryRoot =
                        entrySub.from(sy.gov.sla.litigationprogression.domain.HearingProgressionEntry.class);
                Root<sy.gov.sla.litigationregistration.domain.CaseStage> stageJoin = entrySub.from(
                        sy.gov.sla.litigationregistration.domain.CaseStage.class);
                entrySub.select(cb.literal(1L)).where(
                        cb.equal(entryRoot.get("caseStageId"), stageJoin.get("id")),
                        cb.equal(stageJoin.get("litigationCaseId"), root.get("id")),
                        cb.equal(entryRoot.get("hearingDate"), hearingDate));

                ands.add(cb.or(cb.exists(stageSub), cb.exists(entrySub)));
            }
            return cb.and(ands.toArray(new Predicate[0]));
        };
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
        // Customer feedback round-2 (PR-15a): editing basic case data is now
        // reserved to the section head of (createdBranchId, createdDepartmentId).
        // The legacy EDIT_CASE_BASIC_DATA clerk delegation no longer applies.
        authorizationService.requireSectionHeadOf(actor, lc.getCreatedBranchId(),
                lc.getCreatedDepartmentId());

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
        UserActionLog.action("updated basic data of case #{}", caseId);
        return toDto(lc, stageRepo.findByLitigationCaseId(caseId));
    }

    // ==========================================================
    // Correct finalized case (PR-11 / blueprint C-6 / customer Q-D)
    // ==========================================================
    /**
     * Section-head correction of a FINALIZED case that has not been promoted
     * past its current stage. Per the customer's Q-D answer:
     * <ul>
     *   <li>Auth uses the CURRENT stage's (branch, dept), so correction rights
     *       transfer to the destination dept's section head on promotion.</li>
     *   <li>Hearing history is NEVER touched (D-022 append-only invariant).</li>
     *   <li>Once promoted, the case's previous stages become read-only and
     *       this endpoint refuses with STAGE_READ_ONLY.</li>
     * </ul>
     * Required permission: SECTION_HEAD of the current stage's (branch, dept),
     * OR ADMIN_CLERK with {@code CORRECT_FINALIZED_CASE} delegation.
     */
    public LitigationCaseDto correctFinalizedCase(Long caseId,
                                                  CorrectFinalizedCaseRequest req,
                                                  Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));

        if (lc.getCurrentStageId() == null) {
            throw new BadRequestException("NO_CURRENT_STAGE", "Case has no current stage");
        }
        CaseStage stage = stageRepo.findById(lc.getCurrentStageId())
                .orElseThrow(() -> new BadRequestException("NO_CURRENT_STAGE",
                        "Case has no current stage"));

        if (stage.isReadOnly()) {
            // Once promoted, correction rights have transferred away.
            throw new BadRequestException("STAGE_READ_ONLY",
                    "Current stage is read-only — correction rights have moved to the destination department");
        }
        if (stage.getStageStatus() != StageStatus.FINALIZED) {
            // Pre-finalize, use updateBasicData. Correction is for resolved register only.
            throw new BadRequestException("STAGE_NOT_FINALIZED",
                    "Correction is only allowed on finalized stages — use updateBasicData for in-progress cases");
        }

        // Auth — uses the CURRENT stage's branch/dept (Q-D rule).
        // Customer feedback round-2 (PR-15a): correction is reserved to the
        // section head of the current stage; the CORRECT_FINALIZED_CASE clerk
        // delegation no longer applies.
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        authorizationService.requireSectionHeadOf(actor, stage.getBranchId(),
                stage.getDepartmentId());

        // Apply patch fields (only those supplied).
        if (req.originalBasisNumber() != null) lc.setOriginalBasisNumber(req.originalBasisNumber());
        if (req.basisYear() != null) lc.setBasisYear(req.basisYear());
        if (req.stageBasisNumber() != null) stage.setStageBasisNumber(req.stageBasisNumber());
        if (req.stageYear() != null) stage.setStageYear(req.stageYear());

        // Decision corrections — load decision attached to the current (finalized) stage.
        boolean decisionTouched = req.decisionNumber() != null
                || req.decisionDate() != null
                || req.decisionType() != null
                || req.adjudgedAmount() != null
                || req.currencyCode() != null;
        if (decisionTouched) {
            CaseDecision decision = decisionRepo.findByCaseStageId(stage.getId())
                    .orElseThrow(() -> new BadRequestException("DECISION_NOT_FOUND",
                            "No decision exists for this finalized stage"));
            if (req.decisionNumber() != null) decision.setDecisionNumber(req.decisionNumber());
            if (req.decisionDate() != null)   decision.setDecisionDate(req.decisionDate());
            if (req.decisionType() != null)   decision.setDecisionType(req.decisionType());
            if (req.adjudgedAmount() != null) decision.setAdjudgedAmount(req.adjudgedAmount());
            if (req.currencyCode() != null)   decision.setCurrencyCode(req.currencyCode());
        }

        lc.setUpdatedAt(Instant.now());
        UserActionLog.action("corrected finalized case #{} (basis/decision fields)", caseId);
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

        UserActionLog.action("assigned lawyer (user #{}) to case #{}", req.lawyerUserId(), caseId);

        return toDto(lc, stageRepo.findByLitigationCaseId(caseId));
    }

    // ========== Mapping ==========

    private LitigationCaseDto toDto(LitigationCase lc, List<CaseStage> stages) {
        var stageDtos = stages.stream().map(this::toStageDto).toList();
        String ownerFullName = resolveFullName(lc.getCurrentOwnerUserId());
        return new LitigationCaseDto(
                lc.getId(), lc.getPublicEntityName(), lc.getPublicEntityPosition(),
                lc.getOpponentName(), lc.getOriginalBasisNumber(), lc.getBasisYear(),
                lc.getOriginalRegistrationDate(), lc.getCreatedBranchId(),
                lc.getCreatedDepartmentId(), lc.getCreatedCourtId(), lc.getChamberName(),
                lc.getCourtType(),
                lc.getCurrentStageId(), lc.getCurrentOwnerUserId(), ownerFullName,
                lc.getLifecycleStatus(),
                lc.getCreatedByUserId(), lc.getCreatedAt(), lc.getUpdatedAt(),
                lc.getLastHearingDate(), stageDtos);
    }

    private CaseStageDto toStageDto(CaseStage s) {
        return new CaseStageDto(s.getId(), s.getLitigationCaseId(), s.getStageType(),
                s.getBranchId(), s.getDepartmentId(), s.getCourtId(), s.getChamberName(),
                s.getStageBasisNumber(), s.getStageYear(),
                s.getAssignedLawyerUserId(), resolveFullName(s.getAssignedLawyerUserId()),
                s.getStageStatus(), s.getParentStageId(), s.isReadOnly(),
                s.getFirstHearingDate(), s.getFirstPostponementReason(),
                s.getStartedAt(), s.getEndedAt());
    }

    private String resolveFullName(Long userId) {
        if (userId == null) return null;
        return userRepo.findById(userId).map(u -> u.getFullName()).orElse(null);
    }
}

