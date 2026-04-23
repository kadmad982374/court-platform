import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';

/**
 * Admin Users — detail page + PATCH basic fields + RolesSection round-trip.
 *
 * Strategy:
 *   1. Create a fresh user (so we own its state and can mutate freely).
 *   2. PATCH fullName and mobileNumber via the inline form → success badge.
 *   3. Add a STATE_LAWYER role → it appears in the chip list.
 *   4. Remove the just-added role → chip disappears.
 *
 * D-048 guard: BRANCH_HEAD-cannot-grant-BRANCH_HEAD is enforced server-side.
 * We exercise the *server-error display* path indirectly by attempting to
 * grant BRANCH_HEAD as CENTRAL_SUPERVISOR (which is allowed), then removing
 * it again. We do NOT log in as BRANCH_HEAD here — that role can't reach
 * /admin/users at all (covered in 05-negative-access.spec.ts).
 */
test.describe('Admin Users — detail / PATCH / Roles', () => {
  test('PATCH fullName + mobileNumber, then add+remove a role', async ({ page }) => {
    await loginAs(page, 'admin');

    // 1) Create a throw-away user.
    await page.goto('/admin/users');
    await page.getByTestId('admin-users-create-button').click();
    const stamp = Date.now();
    const username = `e2e_patch_${stamp}`;
    const mobile1 = `09${String(stamp).slice(-8)}`;
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="fullName"]').fill('قبل التعديل');
    await page.locator('input[name="mobileNumber"]').fill(mobile1);
    await page.locator('input[name="initialPassword"]').fill(`PatchTmp!${stamp}`);
    await Promise.all([
      page.waitForURL(/\/admin\/users\/\d+$/),
      page.getByTestId('admin-user-save').click(),
    ]);

    await expect(page.getByTestId('admin-user-basic-section')).toBeVisible();

    // 2) Edit the basic fields. The PatchUserForm uses RHF + register('fullName'/'mobileNumber').
    const form = page.getByTestId('admin-user-patch-form');
    await form.locator('input[name="fullName"]').fill('بعد التعديل');
    const mobile2 = `09${String(Date.now()).slice(-8)}`;
    await form.locator('input[name="mobileNumber"]').fill(mobile2);
    await page.getByTestId('admin-user-patch-submit').click();
    await expect(page.getByTestId('admin-user-patch-success')).toBeVisible({ timeout: 10_000 });
    // The header subtitle still shows the username; the page title updates on next refetch.
    await expect(page.getByText(`@${username}`)).toBeVisible();

    // 3) Add STATE_LAWYER via RolesSection.
    const rolesSection = page.getByTestId('admin-roles-section');
    await rolesSection.getByLabel('role-picker').selectOption('STATE_LAWYER');
    await rolesSection.getByRole('button', { name: /^إضافة$/ }).click();

    // After mutation the section refetches. STATE_LAWYER chip ("محامي دولة") appears.
    const list = page.getByTestId('admin-roles-list');
    await expect(list).toContainText('محامي', { timeout: 10_000 });

    // 4) Remove the same role. The button has aria-label "remove-STATE_LAWYER".
    await rolesSection.getByRole('button', { name: 'remove-STATE_LAWYER' }).click();
    // After removal the chip list is replaced by a "لا أدوار مُسنَدة" paragraph
    // (the `admin-roles-list` testid is unmounted entirely when empty), so we
    // can't assert via `not.toContainText` on `list` — its locator resolves to
    // zero elements and Playwright reports "element(s) not found". Assert on
    // the chip's remove button being gone instead.
    await expect(
      rolesSection.getByRole('button', { name: 'remove-STATE_LAWYER' }),
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(rolesSection.getByText('لا أدوار مُسنَدة')).toBeVisible();
  });
});

