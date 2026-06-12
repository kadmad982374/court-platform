package sy.gov.sla.pendingsubmission.application;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.organization.application.OrganizationService;
import sy.gov.sla.pendingsubmission.api.CreatePendingSubmissionRequest;
import sy.gov.sla.pendingsubmission.api.PendingSubmissionDto;
import sy.gov.sla.pendingsubmission.api.UpdatePendingSubmissionRequest;
import sy.gov.sla.pendingsubmission.domain.PendingSubmission;
import sy.gov.sla.pendingsubmission.infrastructure.PendingSubmissionRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * منطق سجل «تحت الرفع» (طلب العميل #3).
 *
 * الصلاحيات (مثل الدعاوى، لكن دون تفويضات):
 *  - الإضافة/التعديل: رئيس القسم أو الموظف الإداري لـ (الفرع، القسم).
 *  - الاطّلاع: المشرف المركزي/القراءة فقط (الكل)، رئيس الفرع (فروعه)،
 *    ورئيس القسم/الموظف الإداري (قسمه). رئيس الفرع والمشرف للقراءة فقط.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class PendingSubmissionService {

    private final PendingSubmissionRepository repo;
    private final AuthorizationService authorizationService;
    private final OrganizationService organizationService;

    // ========== Create ==========

    public PendingSubmissionDto create(CreatePendingSubmissionRequest req, Long actorUserId) {
        if (!organizationService.departmentBelongsToBranch(req.departmentId(), req.branchId())) {
            throw new BadRequestException("INCONSISTENT_SCOPE", "Department does not belong to branch");
        }
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireCanManage(actor, req.branchId(), req.departmentId());

        Instant now = Instant.now();
        PendingSubmission ps = PendingSubmission.builder()
                .branchId(req.branchId())
                .departmentId(req.departmentId())
                .incomingNumber(req.incomingNumber())
                .letterNumber(req.letterNumber())
                .publicEntityName(req.publicEntityName())
                .opponentName(req.opponentName())
                .subject(req.subject())
                .notes(req.notes())
                .createdByUserId(actorUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        ps = repo.save(ps);
        UserActionLog.action("created pending-submission #{} (incoming={}, branch={}, dept={})",
                ps.getId(), ps.getIncomingNumber(), ps.getBranchId(), ps.getDepartmentId());
        return toDto(ps);
    }

    // ========== Update ==========

    public PendingSubmissionDto update(Long id, UpdatePendingSubmissionRequest req, Long actorUserId) {
        PendingSubmission ps = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Pending submission not found: " + id));
        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        requireCanManage(actor, ps.getBranchId(), ps.getDepartmentId());

        if (req.incomingNumber() != null)    ps.setIncomingNumber(req.incomingNumber());
        if (req.letterNumber() != null)      ps.setLetterNumber(req.letterNumber());
        if (req.publicEntityName() != null)  ps.setPublicEntityName(req.publicEntityName());
        if (req.opponentName() != null)      ps.setOpponentName(req.opponentName());
        if (req.subject() != null)           ps.setSubject(req.subject());
        if (req.notes() != null)             ps.setNotes(req.notes());
        ps.setUpdatedAt(Instant.now());

        UserActionLog.action("updated pending-submission #{}", id);
        return toDto(ps);
    }

    // ========== Read ==========

    @Transactional(readOnly = true)
    public PageResponse<PendingSubmissionDto> list(String q, int page, int size, Long actorUserId) {
        if (size <= 0) size = 20;
        if (size > 100) size = 100;
        if (page < 0) page = 0;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        AuthorizationContext actor = authorizationService.loadContext(actorUserId);
        Specification<PendingSubmission> scope = buildScopeSpec(actor);
        Specification<PendingSubmission> filter = buildQuerySpec(q);
        Specification<PendingSubmission> spec = scope;
        if (filter != null) spec = (spec == null) ? filter : spec.and(filter);

        Page<PendingSubmission> p = (spec == null)
                ? Page.empty(pageable)
                : repo.findAll(spec, pageable);
        List<PendingSubmissionDto> content = p.getContent().stream().map(this::toDto).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }

    // ========== Helpers ==========

    /** الإضافة/التعديل: رئيس القسم أو الموظف الإداري للقسم المستهدف فقط. */
    private void requireCanManage(AuthorizationContext actor, Long branchId, Long departmentId) {
        if (actor.isSectionHeadOf(branchId, departmentId)
                || actor.isAdminClerkOf(branchId, departmentId)) {
            return;
        }
        UserActionLog.denied("tried to manage pending-submission in branch={} dept={} — reason=not_clerk_or_section_head",
                branchId, departmentId);
        throw new ForbiddenException("Reserved to the section head or admin clerk of this department");
    }

    /** نطاق القراءة — يماثل نطاق الدعاوى (D-021). يُرجع null لنتيجة فارغة. */
    private Specification<PendingSubmission> buildScopeSpec(AuthorizationContext ctx) {
        if (ctx.isCentralSupervisor() || ctx.isReadOnlySupervisor() || ctx.isSpecialInspector()) {
            return (root, q, cb) -> cb.conjunction();
        }
        return (root, q, cb) -> {
            List<Predicate> ors = new ArrayList<>();
            if (!ctx.headOfBranches().isEmpty()) {
                ors.add(root.get("branchId").in(ctx.headOfBranches()));
            }
            for (var m : ctx.departmentMemberships()) {
                if (!m.active()) continue;
                if (m.type() == MembershipType.SECTION_HEAD || m.type() == MembershipType.ADMIN_CLERK) {
                    if (m.departmentId() == null) continue;
                    ors.add(cb.and(
                            cb.equal(root.get("branchId"), m.branchId()),
                            cb.equal(root.get("departmentId"), m.departmentId())));
                }
            }
            if (ors.isEmpty()) return cb.disjunction();
            return cb.or(ors.toArray(new Predicate[0]));
        };
    }

    /** بحث حر على رقم الوارد/رقم الكتاب/الجهة/الخصم. */
    private Specification<PendingSubmission> buildQuerySpec(String q) {
        if (q == null || q.isBlank()) return null;
        String pattern = "%" + q.trim().toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("incomingNumber")), pattern),
                cb.like(cb.lower(root.get("letterNumber")), pattern),
                cb.like(cb.lower(root.get("publicEntityName")), pattern),
                cb.like(cb.lower(root.get("opponentName")), pattern));
    }

    private PendingSubmissionDto toDto(PendingSubmission ps) {
        return new PendingSubmissionDto(
                ps.getId(), ps.getBranchId(), ps.getDepartmentId(),
                ps.getIncomingNumber(), ps.getLetterNumber(), ps.getPublicEntityName(),
                ps.getOpponentName(), ps.getSubject(), ps.getNotes(),
                ps.getCreatedByUserId(), ps.getCreatedAt(), ps.getUpdatedAt());
    }
}
