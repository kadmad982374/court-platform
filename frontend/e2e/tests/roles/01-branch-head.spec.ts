import { test, expect } from '@playwright/test';
import { openAs } from './_fixtures/roleSession';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 1 — BRANCH_HEAD (`head_dam`)
 *
 * Branch head with no SECTION_HEAD or ADMIN_CLERK delegations → reads the
 * branch's cases but cannot create / assign through the UI.
 */
test.describe.serial('Role: BRANCH_HEAD (head_dam)', () => {
  test('login + sidebar', async ({ page }) => {
    const s = await openAs(page, 'branchHead');
    await s.expectFullSidebar();
  });

  test('cases list reachable, opens detail, no assign-lawyer surface', async ({ page }) => {
    await openAs(page, 'branchHead');
    await page.goto(URL.cases);
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);

    await page.goto(`/cases/${SEED.CASE_FRESH}`);
    await expect(page.getByText(AR.pageBasicInfo).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TID.assignLawyerSection)).toHaveCount(0);
  });

  test('create-case is gated by the page', async ({ page }) => {
    await openAs(page, 'branchHead');
    await page.goto(URL.newCase);
    await expect(page.getByText(AR.msgNoCreateCase)).toBeVisible();
  });

  test('resolved-register and execution-files are reachable as read paths', async ({ page }) => {
    await openAs(page, 'branchHead');
    for (const p of [URL.resolved, URL.execution]) {
      await page.goto(p);
      await expect(page).toHaveURL(new RegExp(p.replace(/\//g, '\\/') + '($|\\?)'));
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    }
  });
});

