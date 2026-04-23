package sy.gov.sla.reminders.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.application.CaseStagePort.StageInfo;
import sy.gov.sla.litigationregistration.domain.LitigationCase;
import sy.gov.sla.litigationregistration.infrastructure.LitigationCaseRepository;
import sy.gov.sla.reminders.api.CreateReminderRequest;
import sy.gov.sla.reminders.api.ReminderDto;
import sy.gov.sla.reminders.domain.Reminder;
import sy.gov.sla.reminders.domain.ReminderStatus;
import sy.gov.sla.reminders.infrastructure.ReminderRepository;

import java.time.Instant;
import java.util.List;

/**
 * تذكيرات شخصية على الدعوى. Phase 6 (D-037).
 *
 * قواعد:
 *  - إنشاء/قراءة: فقط إذا كان المستخدم ضمن read-scope للدعوى (D-021).
 *  - تحديث الحالة: فقط من قِبل مالك التذكير (منشئه).
 *  - لا تذكيرات مشتركة في Phase 6.
 *
 * ملاحظة على D-023: نقرأ LitigationCase مباشرة من repo داخل نفس الـ classpath
 * (litigationregistration). تجنبًا لكسر الحدود قراءةً، نَستخدم فقط حقول
 * (branchId, departmentId, currentOwnerUserId) ولا نُعدِّل أي شيء على الكيان.
 * نمط مماثل لـ resolvedregister الذي يقرأ عبر JDBC. هنا نقرأ عبر JpaRepository
 * لأن نطاق القراءة محدود بدعوى واحدة.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ReminderService {

    private final ReminderRepository repo;
    private final LitigationCaseRepository caseRepo;
    private final CaseStagePort caseStagePort;
    private final AuthorizationService authorizationService;

    public ReminderDto create(Long caseId, CreateReminderRequest req, Long actorUserId) {
        LitigationCase lc = loadCaseAndRequireRead(caseId, actorUserId);
        if (req.caseStageId() != null) {
            // التحقق أن المرحلة تنتمي للدعوى نفسها
            StageInfo s = caseStagePort.find(req.caseStageId())
                    .orElseThrow(() -> new BadRequestException("STAGE_NOT_FOUND", "Stage not found"));
            if (!lc.getId().equals(s.litigationCaseId())) {
                throw new BadRequestException("STAGE_CASE_MISMATCH",
                        "Stage does not belong to the given case");
            }
        }
        Instant now = Instant.now();
        Reminder r = Reminder.builder()
                .litigationCaseId(caseId)
                .caseStageId(req.caseStageId())
                .ownerUserId(actorUserId)
                .reminderAt(req.reminderAt())
                .reminderText(req.reminderText())
                .status(ReminderStatus.PENDING)
                .createdAt(now)
                .build();
        return toDto(repo.save(r));
    }

    @Transactional(readOnly = true)
    public List<ReminderDto> list(Long caseId, Long actorUserId) {
        loadCaseAndRequireRead(caseId, actorUserId);
        return repo.findByLitigationCaseIdAndOwnerUserIdOrderByReminderAtAsc(caseId, actorUserId)
                .stream().map(this::toDto).toList();
    }

    public ReminderDto updateStatus(Long reminderId, ReminderStatus newStatus, Long actorUserId) {
        Reminder r = repo.findById(reminderId)
                .orElseThrow(() -> new NotFoundException("Reminder not found: " + reminderId));
        if (!r.getOwnerUserId().equals(actorUserId)) {
            throw new ForbiddenException("Reminder does not belong to current user");
        }
        // توضيح: لا re-open بعد DONE/CANCELLED — D-037.
        if (r.getStatus() != ReminderStatus.PENDING && newStatus == ReminderStatus.PENDING) {
            throw new BadRequestException("INVALID_TRANSITION",
                    "Cannot revert reminder to PENDING");
        }
        r.setStatus(newStatus);
        return toDto(r);
    }

    private LitigationCase loadCaseAndRequireRead(Long caseId, Long actorUserId) {
        LitigationCase lc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        authorizationService.requireReadAccessToCase(ctx,
                lc.getCreatedBranchId(), lc.getCreatedDepartmentId(), lc.getCurrentOwnerUserId());
        return lc;
    }

    private ReminderDto toDto(Reminder r) {
        return new ReminderDto(r.getId(), r.getLitigationCaseId(), r.getCaseStageId(),
                r.getOwnerUserId(), r.getReminderAt(), r.getReminderText(),
                r.getStatus(), r.getCreatedAt());
    }
}

