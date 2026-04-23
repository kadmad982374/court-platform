import { test } from '@playwright/test';

/**
 * Documented gaps — surfaced as `test.skip` so they appear in the report
 * as "skipped (documented)" instead of being silently absent.
 *
 * Each skip cross-references the source of truth in /docs.
 */
test.describe('Documented gaps (kept visible as skipped tests)', () => {
  test.skip('User Admin CRUD UI — KNOWN-GAP-001 (no /admin/users route built)', () => { /* docs/project-ui/UI_RUNTIME_BUGS_FOUND.md */ });

  test.skip('Postponement-reasons HTTP lookup — addressed by /api/v1/postponement-reasons (rebuild backend); was KNOWN-GAP-002', () => {});

  test.skip('Reset-password OTP loop — ENV-LIMIT-002 (OTP only printed to backend log)', () => {});

  test.skip('Attachment authenticated download — D-035 / KNOWN-GAP-004 (local-FS gap)', () => {});

  test.skip('Promote-to-execution live POST — Case 4 already promoted by V22 seed (UI_ROLE_RUNTIME_MATRIX_E2E §6)', () => {});

  test.skip('localStorage → httpOnly cookie migration — D-044 / KNOWN-GAP-003 (post-pilot hardening)', () => {});

  test.skip('SPECIAL_INSPECTOR journey — no seeded account in V20–V22', () => {});

  test.skip('Rollover / finalize submit through UI — would mutate shared seed; mutation covered API-side in DEMO_SEED_RUNTIME_VERIFICATION.md', () => {});
});

