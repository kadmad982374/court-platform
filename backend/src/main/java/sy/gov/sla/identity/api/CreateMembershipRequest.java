package sy.gov.sla.identity.api;

import jakarta.validation.constraints.NotNull;
import sy.gov.sla.access.domain.MembershipType;

/**
 * Mini-Phase B — body for {@code POST /api/v1/users/{id}/department-memberships}.
 *
 * <p>For {@link MembershipType#BRANCH_HEAD}, {@code departmentId} must be {@code null}.
 * For all other types, {@code departmentId} is required and must belong to {@code branchId}.</p>
 */
public record CreateMembershipRequest(
        @NotNull Long branchId,
        Long departmentId,
        @NotNull MembershipType membershipType,
        Boolean primary,
        Boolean active
) {}

