import { test, expect } from '@playwright/test';
import { openAs } from './_fixtures/roleSession';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 7 — READ_ONLY_SUPERVISOR (`viewer`)
 *
 * Pure read role. All write surfaces must be hidden.
 */
test.describe.serial('Role: READ_ONLY_SUPERVISOR (viewer)', () => {
  test('login + sidebar', async ({ page }) => {
    const s = await openAs(page, 'viewer');
    await s.expectFullSidebar();
  });

  test('cases list reachable; no create-case button surface', async ({ page }) => {
    await openAs(page, 'viewer');
    await page.goto(URL.cases);
    await expect(page).toHaveURL(/\/cases$/);
    // The "إنشاء دعوى" toolbar button must be hidden for viewer
    await expect(page.getByRole('button', { name: /إنشاء دعوى/ })).toHaveCount(0);
  });

  test('create-case page renders the gating message', async ({ page }) => {
    await openAs(page, 'viewer');
    await page.goto(URL.newCase);
    await expect(page.getByText(AR.msgNoCreateCase)).toBeVisible();
  });

  test('case detail page hides assign-lawyer section', async ({ page }) => {
    await openAs(page, 'viewer');
    await page.goto(`/cases/${SEED.CASE_FRESH}`);
    await expect(
      page.getByText(AR.pageBasicInfo).or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TID.assignLawyerSection)).toHaveCount(0);
  });

  test('knowledge directory pages reachable', async ({ page }) => {
    await openAs(page, 'viewer');
    for (const p of [URL.legalLibrary, URL.publicEntities, URL.circulars]) {
      await page.goto(p);
      await expect(page).toHaveURL(new RegExp(p.replace(/\//g, '\\/') + '($|\\?)'));
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    }
  });
});

