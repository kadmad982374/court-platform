import { test, expect } from '@playwright/test';
import { openAs } from './_fixtures/roleSession';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 4 — ADMIN_CLERK WITHOUT ASSIGN_LAWYER (`clerk2_fi_dam`)
 *
 * V21 deliberately grants this clerk the FULL delegation set EXCEPT
 * ASSIGN_LAWYER (so the demo proves D-046 specifically). Therefore:
 *   ✅ /cases/new MUST render the create form (NOT the gating message)
 *   ❌ assign-lawyer section MUST NOT appear on /cases/:id
 */
test.describe.serial('Role: ADMIN_CLERK − ASSIGN_LAWYER (clerk2_fi_dam)', () => {
  test('login + sidebar', async ({ page }) => {
    const s = await openAs(page, 'clerkNoAssign');
    await s.expectFullSidebar();
  });

  test('cases list reachable; create-case form is reachable (CREATE_CASE delegated)', async ({ page }) => {
    await openAs(page, 'clerkNoAssign');
    await page.goto(URL.cases);
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await page.goto(URL.newCase);
    // Has CREATE_CASE → must NOT show gating message; submit button visible
    await expect(page.getByText(AR.msgNoCreateCase)).toHaveCount(0);
    await expect(page.getByRole('button', { name: AR.btnCreateCaseSubmit })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('assign-lawyer section MUST NOT be present in the case detail', async ({ page }) => {
    await openAs(page, 'clerkNoAssign');
    await page.goto(`/cases/${SEED.CASE_FRESH}`);
    // Page renders OR FORBIDDEN — either way, the section must be absent
    await expect(
      page.getByText(AR.pageBasicInfo).or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TID.assignLawyerSection)).toHaveCount(0);
  });

  test('notifications page reachable', async ({ page }) => {
    await openAs(page, 'clerkNoAssign');
    await page.goto(URL.notifications);
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  });
});


