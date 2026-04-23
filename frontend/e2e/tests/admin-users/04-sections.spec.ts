import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';

/**
 * Admin Users — Memberships / Delegations / Court-access section presence
 * + a state-isolated MEMBERSHIP add round-trip on a freshly created user.
 *
 * We don't mutate seed users' memberships (those drive the rest of the
 * E2E suite); we work on a brand-new throw-away user instead.
 */
test.describe('Admin Users — Sections (memberships / delegations / court-access)', () => {
  test('all 4 admin sections render on detail page for a fresh user', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.getByTestId('admin-users-create-button').click();

    const stamp = Date.now();
    await page.locator('input[name="username"]').fill(`e2e_sec_${stamp}`);
    await page.locator('input[name="fullName"]').fill('قسم اختبار');
    await page.locator('input[name="mobileNumber"]').fill(`09${String(stamp).slice(-8)}`);
    await page.locator('input[name="initialPassword"]').fill(`SecTmp!${stamp}`);
    await Promise.all([
      page.waitForURL(/\/admin\/users\/\d+$/),
      page.getByTestId('admin-user-save').click(),
    ]);

    await expect(page.getByTestId('admin-roles-section')).toBeVisible();
    await expect(page.getByTestId('admin-memberships-section')).toBeVisible();
    await expect(page.getByTestId('admin-delegations-section')).toBeVisible();
    await expect(page.getByTestId('admin-court-access-section')).toBeVisible();

    // Empty-state text rendered for fresh user (no memberships yet).
    await expect(page.getByTestId('admin-memberships-section')).toContainText(/لا عضويات/);
  });

  test('can add a STATE_LAWYER membership on a fresh user', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.getByTestId('admin-users-create-button').click();

    const stamp = Date.now();
    await page.locator('input[name="username"]').fill(`e2e_mem_${stamp}`);
    await page.locator('input[name="fullName"]').fill('عضوية اختبار');
    await page.locator('input[name="mobileNumber"]').fill(`09${String(stamp).slice(-8)}`);
    await page.locator('input[name="initialPassword"]').fill(`MemTmp!${stamp}`);
    await Promise.all([
      page.waitForURL(/\/admin\/users\/\d+$/),
      page.getByTestId('admin-user-save').click(),
    ]);

    const sec = page.getByTestId('admin-memberships-section');
    await expect(sec).toBeVisible();

    // Pick the first branch (any active branch).
    const branchSelect = sec.getByLabel('membership-branch');
    await branchSelect.waitFor({ state: 'visible' });
    const branchOptions = await branchSelect.locator('option').all();
    // option[0] is the placeholder "— اختر —"; pick option[1] if present.
    test.skip(branchOptions.length < 2, 'No active branch in seed — cannot exercise membership add.');
    const firstBranchValue = await branchOptions[1].getAttribute('value');
    await branchSelect.selectOption(firstBranchValue!);

    const deptSelect = sec.getByLabel('membership-department');
    // departments are loaded after branch selection
    await expect(deptSelect).toBeEnabled({ timeout: 10_000 });
    const deptOptions = await deptSelect.locator('option').all();
    test.skip(deptOptions.length < 2, 'No active department under the chosen branch.');
    const firstDeptValue = await deptOptions[1].getAttribute('value');
    await deptSelect.selectOption(firstDeptValue!);

    await sec.getByLabel('membership-type').selectOption('STATE_LAWYER');

    await sec.getByRole('button', { name: /إضافة عضوية/ }).click();

    // After success, the empty-state text disappears and the table renders.
    await expect(sec.locator('[data-testid="admin-memberships-table"]')).toBeVisible({
      timeout: 10_000,
    });
  });
});

