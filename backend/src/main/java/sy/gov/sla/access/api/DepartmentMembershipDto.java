package sy.gov.sla.access.api;

import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.organization.domain.DepartmentType;

/**
 * Membership row returned by {@code /auth/me} and admin endpoints.
 *
 * {@code departmentType} is the type of the linked department
 * (CONCILIATION / FIRST_INSTANCE / APPEAL / EXECUTION) or {@code null} when
 * the membership is branch-scoped (BRANCH_HEAD with no department) — the
 * frontend uses it to gate views like "execution files" by section type
 * (client feedback: a FIRST_INSTANCE section head must not see execution
 * files; backend re-validates regardless).
 */
public record DepartmentMembershipDto(
        Long id, Long userId, Long branchId, Long departmentId,
        DepartmentType departmentType,
        MembershipType membershipType, boolean primary, boolean active) {}
