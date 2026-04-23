import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { DEMO_PASSWORD } from '../fixtures/users';

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

/** Find a case ID by its original_basis_number via the backend API. */
async function findCaseByBasis(basisNumber: string): Promise<number | null> {
  const loginResp = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'section_fi_dam', password: DEMO_PASSWORD }),
  });
  const { accessToken } = await loginResp.json();
  const resp = await fetch(`${BACKEND_URL}/api/v1/cases?page=0&size=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const match = data.content?.find((c: { originalBasisNumber: string }) =>
    c.originalBasisNumber === basisNumber,
  );
  return match?.id ?? null;
}

/**
 * 10) Documented gaps — these flows are intentionally NOT exercised because
 * they correspond to known, accepted gaps. They are recorded as `test.skip`
 * with explicit reasons so reports show them as "skipped (documented gap)"
 * instead of silently passing or being absent.
 *
 * References:
 *   - docs/project/FINAL_PRODUCTION_BLOCKERS.md
 *   - docs/project/BACKEND_GAP_PHASE11_LOOKUPS.md
 *   - docs/project-ui/UI_RUNTIME_BUGS_FOUND.md
 *   - docs/project-ui/UI_PLAYWRIGHT_FULL_COVERAGE_REPORT.md
 *
 * Note: KNOWN-GAP-001 (User Admin CRUD UI) was CLOSED by UI sub-phase B
 * (2026-04). Browser coverage now lives under e2e/tests/admin-users/*.
 */
test.describe('10) Known documented gaps (skipped on purpose)', () => {
  test.skip('Postponement reasons HTTP lookup — backend endpoint missing (KNOWN-GAP-002)', () => {
    // CreateCasePage uses free text per D-020; no GET /postponement-reasons.
  });

  test.skip('OTP-based reset password end-to-end — OTP delivered via backend logs only (ENV-LIMIT-002)', () => {
    // Cannot extract OTP programmatically from the browser. SMS gateway
    // hardening is explicitly POSTPONED (see FINAL_PRODUCTION_READINESS_PLAN §3).
  });

  test.skip('Attachment authenticated download — relies on local FS storage (KNOWN-GAP-004 / D-035)', () => {
    // V22 seed inserts metadata only; the file is not on disk. Download will 404.
    // Object storage (S3/MinIO) + AV scan are explicitly POSTPONED.
  });

  test.skip('localStorage → httpOnly cookies migration (KNOWN-GAP-003 / D-044)', () => {
    // Requires D-049+ decision; UI still uses localStorage. POSTPONED.
  });

  test('Promote-to-execution — V24 seed (DEMO-APPEAL-FINAL-005: appeal FINALIZED, not yet promoted)', async ({ page }) => {
    // Find the V24 seed case dynamically — ID depends on DB sequence.
    const caseId = await findCaseByBasis('DEMO-APPEAL-FINAL-005');
    test.skip(!caseId, 'V24 seed case DEMO-APPEAL-FINAL-005 not found in DB');

    // On first run this promotes successfully.
    // On re-runs the stage is already PROMOTED_TO_EXECUTION → backend returns
    // 409 STAGE_ALREADY_PROMOTED. Both outcomes are accepted below.
    await loginAs(page, 'sectionHead');
    await page.goto(`/cases/${caseId}`);
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });

    // The promote button is always visible for SECTION_HEAD (role-based, not state-based).
    const promoteBtn = page.getByRole('button', { name: /ترقية إلى التنفيذ/ });
    await expect(promoteBtn).toBeVisible({ timeout: 10_000 });
    await promoteBtn.click();

    // Modal must appear.
    await expect(
      page.getByRole('dialog').or(page.getByText(/ترقية الدعوى إلى ملف تنفيذي/)).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Fill the form.
    await page.locator('input[name="enforcingEntityName"]').fill('وزارة الإطار التجريبي');
    await page.locator('input[name="executedAgainstName"]').fill('شركة التنفيذ التجريبية');
    await page.locator('input[name="executionFileType"]').fill('TENFIDH');
    await page.locator('input[name="executionFileNumber"]').fill('EX-V24-005');
    await page.locator('input[name="executionYear"]').fill('2026');
    await page.getByRole('button', { name: /إنشاء ملف تنفيذي/ }).first().click();

    // Accept two outcomes:
    //   a) First run  → navigate to /execution-files/{id}
    //   b) Re-run     → 409 STAGE_ALREADY_PROMOTED — modal stays open
    const navigated = await page.waitForURL(/\/execution-files\/\d+$/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (navigated) {
      // Fresh promote succeeded — verify we are on an execution-file detail page.
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
      test.info().annotations.push({ type: 'result', description: 'promote-to-execution succeeded (fresh run)' });
    } else {
      // Re-run: stage already promoted. Close the modal and verify execution
      // files list shows at least one file (the one created on the first run).
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.goto('/execution-files');
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
      const firstRow = page.locator('table tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 10_000 });
      test.info().annotations.push({ type: 'result', description: 'stage already promoted (re-run) — execution file list confirmed' });
    }
  });

  test.skip('SMS rate-limiting / brute-force lockout — production hardening POSTPONED', () => {
    // No rate limiter wired yet. Tracked in FINAL_PRODUCTION_READINESS_PLAN §3.
  });

  test.skip('Scheduler / external notification channels — D-039 POSTPONED', () => {
    // No scheduler; notifications are listener-driven only. POSTPONED.
  });
});


