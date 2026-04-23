package sy.gov.sla.identity.api;

/** Mini-Phase B — body for {@code PATCH /api/v1/users/{id}/department-memberships/{mid}}. Both fields optional (null = unchanged). */
public record UpdateMembershipRequest(Boolean active, Boolean primary) {}

