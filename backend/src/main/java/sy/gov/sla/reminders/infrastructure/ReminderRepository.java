package sy.gov.sla.reminders.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.reminders.domain.Reminder;

import java.util.List;

public interface ReminderRepository extends JpaRepository<Reminder, Long> {

    /** يُرجع تذكيرات (المستخدم الحالي) على الدعوى المحددة، الأقدم موعدًا أولًا. */
    List<Reminder> findByLitigationCaseIdAndOwnerUserIdOrderByReminderAtAsc(
            Long litigationCaseId, Long ownerUserId);

    /**
     * PR-8b (customer feedback Q-G) — يُرجع جميع التذكيرات على الدعوى المحددة
     * (أيًّا كان منشؤها). يُستخدَم لرؤساء الفروع/الأقسام والمشرف المركزي
     * كوضع رقابة (read-only) على ما يضعه المحامون.
     */
    List<Reminder> findByLitigationCaseIdOrderByReminderAtAsc(Long litigationCaseId);
}
