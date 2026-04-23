package sy.gov.sla.reminders.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.reminders.domain.Reminder;

import java.util.List;

public interface ReminderRepository extends JpaRepository<Reminder, Long> {

    /** يُرجع تذكيرات (المستخدم الحالي) على الدعوى المحددة، الأحدث أولًا. */
    List<Reminder> findByLitigationCaseIdAndOwnerUserIdOrderByReminderAtAsc(
            Long litigationCaseId, Long ownerUserId);
}

