package sy.gov.sla.access.application;

import java.util.Optional;

/**
 * منفذ Port: تستهلكه access-control لاسترجاع مالك الدعوى دون كسر حدود الوحدات.
 * يُنفَّذ في وحدة litigationregistration كـ adapter (Spring Bean).
 *
 * مرجع DOMAIN_BOUNDARIES.md: لا يجوز استدعاء مستودعات وحدة من وحدة أخرى مباشرة.
 */
public interface CaseOwnershipPort {

    /** مالك الدعوى الحالي (current_owner_user_id)، أو فارغ إن لم تُسنَد بعد. */
    Optional<Long> findCurrentOwner(Long caseId);

    /** الفرع/القسم اللذان أُنشئت فيهما الدعوى — للتحقق من النطاق. */
    Optional<CaseScope> findCaseScope(Long caseId);

    record CaseScope(Long branchId, Long departmentId, Long courtId, Long currentOwnerUserId) {}
}

