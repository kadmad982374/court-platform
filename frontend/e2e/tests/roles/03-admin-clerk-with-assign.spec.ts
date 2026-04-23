import { test, expect } from '@playwright/test';
import { openAs } from './_fixtures/roleSession';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 3 — ADMIN_CLERK with ASSIGN_LAWYER (`clerk_fi_dam`)
 *
 * Has the full delegation set (CREATE_CASE, EDIT_CASE_BASIC_DATA,
 * ASSIGN_LAWYER, PROMOTE_TO_APPEAL, PROMOTE_TO_EXECUTION,
 * ADD_EXECUTION_STEP, …) for DAMASCUS / FIRST_INSTANCE.
 */
test.describe.serial('Role: ADMIN_CLERK + ASSIGN_LAWYER (clerk_fi_dam)', () => {
  test('login + sidebar', async ({ page }) => {
    const s = await openAs(page, 'clerk');
    await s.expectFullSidebar();
  });

  test('cases list reachable; create-case form is reachable (form-only check, idempotent)', async ({ page }) => {
    await openAs(page, 'clerk');
    await page.goto(URL.cases);
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await page.goto(URL.newCase);
    // For clerk WITH delegations, /cases/new must NOT show the gating message
    await expect(page.getByText(AR.msgNoCreateCase)).toHaveCount(0);
    // The form must render (a "قيد الدعوى" submit button exists)
    await expect(page.getByRole('button', { name: AR.btnCreateCaseSubmit })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('assign-lawyer section visible on a case in his department', async ({ page }) => {
    await openAs(page, 'clerk');
    await page.goto(`/cases/${SEED.CASE_FRESH}`);
    await expect(page.getByTestId(TID.assignLawyerSection)).toBeVisible({ timeout: 15_000 });
  });

  test('owner-only stage actions remain hidden for clerk', async ({ page }) => {
    await openAs(page, 'clerk');
    await page.goto(`/stages/${SEED.STAGE_OWNED_BY_LAWYER}`);
    await expect(page.getByRole('button', { name: AR.btnRollover })).toHaveCount(0);
    await expect(page.getByRole('button', { name: AR.btnFinalize })).toHaveCount(0);
  });

  test('execution file detail reachable', async ({ page }) => {
    await openAs(page, 'clerk');
    await page.goto(`/execution-files/${SEED.EXEC_FILE}`);
    await expect(page).toHaveURL(/\/execution-files\/\d+$/);
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  });
});

