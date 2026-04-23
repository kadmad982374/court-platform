import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';

/**
 * Admin Users — create user (D-047 policy):
 *   - admin types the initial password
 *   - the literal "ChangeMe!2026" must be rejected client-side
 *   - server re-validates (we don't fake server behaviour here)
 *
 * Each successful create uses a unique username (Date.now()) so re-runs
 * don't collide on USERNAME_TAKEN.
 */
test.describe('Admin Users — create user (D-047)', () => {
  test('client-side validation: D-047 banned literal password is refused', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.getByTestId('admin-users-create-button').click();

    // Modal renders with the form.
    await expect(page.getByTestId('admin-user-form')).toBeVisible();

    // Use distinct values that pass everything EXCEPT the password rule.
    const stamp = Date.now();
    await page.locator('input[name="username"]').fill(`probe_${stamp}`);
    await page.locator('input[name="fullName"]').fill('مستخدم اختباري');
    await page.locator('input[name="mobileNumber"]').fill('0999999999');
    await page.locator('input[name="initialPassword"]').fill('ChangeMe!2026');

    await page.getByTestId('admin-user-save').click();

    // The Zod refinement message must surface; nothing should navigate.
    await expect(page.getByText('كلمة مرور افتراضية محظورة')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/admin\/users(\?|$)/);
  });

  test('client-side validation: malformed mobile number is refused', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.getByTestId('admin-users-create-button').click();

    const stamp = Date.now();
    await page.locator('input[name="username"]').fill(`probe2_${stamp}`);
    await page.locator('input[name="fullName"]').fill('مستخدم اختباري ٢');
    await page.locator('input[name="mobileNumber"]').fill('12345');
    await page.locator('input[name="initialPassword"]').fill('TempPass!9');
    await page.getByTestId('admin-user-save').click();

    await expect(page.getByText('الصيغة: 09XXXXXXXX')).toBeVisible({ timeout: 5_000 });
  });

  test('happy path: create user → redirect to detail page', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.getByTestId('admin-users-create-button').click();

    const stamp = Date.now();
    const username = `e2e_user_${stamp}`;
    // Generate a unique 09-prefixed mobile number from the timestamp last 8 digits.
    const mobile = `09${String(stamp).slice(-8)}`;
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="fullName"]').fill(`اختبار E2E ${stamp}`);
    await page.locator('input[name="mobileNumber"]').fill(mobile);
    await page.locator('input[name="initialPassword"]').fill(`E2eTemp!${stamp}`);

    await Promise.all([
      page.waitForURL(/\/admin\/users\/\d+$/, { timeout: 15_000 }),
      page.getByTestId('admin-user-save').click(),
    ]);

    // Detail page renders with our chosen full name in the header subtitle.
    await expect(page.getByTestId('admin-user-detail-page')).toBeVisible();
    await expect(page.getByText(`@${username}`)).toBeVisible();
    await expect(page.getByTestId('admin-user-basic-section')).toBeVisible();
    await expect(page.getByTestId('admin-roles-section')).toBeVisible();
    await expect(page.getByTestId('admin-memberships-section')).toBeVisible();
    await expect(page.getByTestId('admin-delegations-section')).toBeVisible();
    await expect(page.getByTestId('admin-court-access-section')).toBeVisible();
  });
});

