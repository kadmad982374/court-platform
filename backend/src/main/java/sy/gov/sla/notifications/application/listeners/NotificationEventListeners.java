package sy.gov.sla.notifications.application.listeners;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.litigationregistration.application.CaseRegisteredEvent;
import sy.gov.sla.litigationregistration.application.LawyerAssignedEvent;
import sy.gov.sla.notifications.application.NotificationService;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * مستهلكو الأحداث ⇒ إشعارات. Phase 6 (D-038, D-010).
 *
 * قاعدة المستلمين:
 *  - CaseRegisteredEvent → SECTION_HEAD + ADMIN_CLERK النشطون في (branch, dept)،
 *    + المحامي المُسنَد إن وُجد عند الإنشاء (initialOwnerUserId).
 *  - LawyerAssignedEvent → المحامي المُسنَد فقط.
 *
 * نقصد عمدًا الحد الأدنى وعدم إغراق رؤساء الفروع/المركزي (D-016).
 *
 * كل المستهلكين {@link Propagation#REQUIRES_NEW}: إذا فشل إنشاء إشعار لا يُسقط
 * الكتابة الأصلية (الدعوى/الإسناد). الـ event يصلهم بعد commit بفضل النمط الافتراضي
 * في Spring لمعاملة الناشر، لكن نضمن العزل إضافيًا.
 */
@Component
@RequiredArgsConstructor
public class NotificationEventListeners {

    private final NotificationService notifications;
    private final AuthorizationService authorization;

    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCaseRegistered(CaseRegisteredEvent ev) {
        Set<Long> recipients = new LinkedHashSet<>();
        recipients.addAll(authorization.findActiveMemberUserIds(
                ev.branchId(), ev.departmentId(), MembershipType.SECTION_HEAD));
        recipients.addAll(authorization.findActiveMemberUserIds(
                ev.branchId(), ev.departmentId(), MembershipType.ADMIN_CLERK));
        if (ev.initialOwnerUserId() != null) recipients.add(ev.initialOwnerUserId());

        String title = "قيد دعوى جديدة";
        String body = "تم قيد دعوى جديدة برقم " + ev.caseId() + " في القسم.";
        for (Long uid : recipients) {
            notifications.createInternal(uid, "CASE_REGISTERED", title, body,
                    "LITIGATION_CASE", ev.caseId());
        }
    }

    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onLawyerAssigned(LawyerAssignedEvent ev) {
        if (ev.lawyerUserId() == null) return;
        notifications.createInternal(ev.lawyerUserId(), "LAWYER_ASSIGNED",
                "إسناد دعوى جديدة لك",
                "تم إسناد الدعوى رقم " + ev.caseId() + " إليك.",
                "LITIGATION_CASE", ev.caseId());
    }

    /** يكشف للاختبارات قائمة المستلمين المتوقعة دون نشر حدث (Optional). */
    public List<Long> computeCaseRegisteredRecipients(Long branchId, Long departmentId,
                                                      Long initialOwnerUserId) {
        Set<Long> recipients = new LinkedHashSet<>();
        recipients.addAll(authorization.findActiveMemberUserIds(branchId, departmentId, MembershipType.SECTION_HEAD));
        recipients.addAll(authorization.findActiveMemberUserIds(branchId, departmentId, MembershipType.ADMIN_CLERK));
        if (initialOwnerUserId != null) recipients.add(initialOwnerUserId);
        return List.copyOf(recipients);
    }
}

