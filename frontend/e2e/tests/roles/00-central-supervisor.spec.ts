import { test, expect } from '@playwright/test';
import { openAs } from './_fixtures/roleSession';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 0 — CENTRAL_SUPERVISOR (`admin`)
 *
 * Bootstrap admin (D-018). Has the platform-wide read superpower but
 * NO branch / section memberships, so write actions on cases must be
 * absent in the UI.
 */
test.describe.serial('Role: CENTRAL_SUPERVISOR (admin)', () => {
  test('login + full sidebar + dashboard', async ({ page }) => {
    const s = await openAs(page, 'admin');
    await s.expectFullSidebar();
  });

  test('cases list reachable + opens any case detail', async ({ page }) => {
    await openAs(page, 'admin');
    await page.goto(URL.cases);
    await expect(page).toHaveURL(/\/cases$/);
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // At least one case row exists (V22 demo seed).
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);

    await page.goto(`/cases/${SEED.CASE_FRESH}`);
    await expect(page.getByText(AR.pageBasicInfo).first()).toBeVisible({ timeout: 15_000 });
    // No write surface for admin (no membership, no SECTION_HEAD).
    await expect(page.getByTestId(TID.assignLawyerSection)).toHaveCount(0);
  });

  test('create-case page renders the gating message', async ({ page }) => {
    await openAs(page, 'admin');
    await page.goto(URL.newCase);
    await expect(page.getByText(AR.msgNoCreateCase)).toBeVisible();
  });

  test('read-only modules reachable: resolved register, execution, knowledge', async ({ page }) => {
    await openAs(page, 'admin');
    for (const path of [URL.resolved, URL.execution, URL.legalLibrary, URL.publicEntities, URL.circulars]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '($|\\?)'));
      // Smoke: page renders SOMETHING (header / table / list).
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('notifications page reachable', async ({ page }) => {
    await openAs(page, 'admin');
    await page.goto(URL.notifications);
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  });
});

