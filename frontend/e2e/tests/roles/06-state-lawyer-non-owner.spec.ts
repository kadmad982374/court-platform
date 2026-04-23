import { test, expect } from '@playwright/test';
import { openAs } from './_fixtures/roleSession';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 6 — STATE_LAWYER NON-OWNER (`lawyer2_fi_dam`)
 *
 * Active lawyer in the same dept but does NOT own Case 2 / Stage 2.
 * Owner-only buttons (rollover/finalize) MUST NOT appear; assign-lawyer
 * MUST NOT appear (lawyer never assigns).
 */
test.describe.serial('Role: STATE_LAWYER non-owner (lawyer2_fi_dam)', () => {
  test('login + sidebar', async ({ page }) => {
    const s = await openAs(page, 'lawyer2');
    await s.expectFullSidebar();
  });

  test('opens foreign case detail — basic info OR FORBIDDEN, no write surface', async ({ page }) => {
    await openAs(page, 'lawyer2');
    await page.goto(`/cases/${SEED.CASE_OWNED_BY_LAWYER}`);
    await expect(
      page.getByText(AR.pageBasicInfo).or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TID.assignLawyerSection)).toHaveCount(0);
  });

  test('owner-only stage actions HIDDEN on a foreign stage', async ({ page }) => {
    await openAs(page, 'lawyer2');
    await page.goto(`/stages/${SEED.STAGE_OWNED_BY_LAWYER}`);
    await expect(page.getByRole('button', { name: AR.btnRollover })).toHaveCount(0);
    await expect(page.getByRole('button', { name: AR.btnFinalize })).toHaveCount(0);
  });

  test('create-case is gated', async ({ page }) => {
    await openAs(page, 'lawyer2');
    await page.goto(URL.newCase);
    await expect(page.getByText(AR.msgNoCreateCase)).toBeVisible();
  });
});

