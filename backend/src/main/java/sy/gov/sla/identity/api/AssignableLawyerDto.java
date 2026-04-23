package sy.gov.sla.identity.api;

/**
 * Mini-Phase A — Assign Lawyer (D-046).
 *
 * Conservative read-only projection used ONLY by
 * {@code GET /api/v1/users?membershipType=STATE_LAWYER}. It is intentionally
 * minimal — no mobileNumber, no delegated permissions, no memberships,
 * no creation timestamps.
 *
 * Reference: docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
 *            docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-046)
 *
 * NOT a generic Users Admin response — see Mini-Phase B for that.
 */
public record AssignableLawyerDto(
        Long id,
        String fullName,
        String username,
        boolean active
) {}

