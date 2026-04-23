import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';

/**
 * Admin Users — list page coverage.
 * UI sub-phase B (D-047 / D-048).
 *
 * Asserts:
 *   - CENTRAL_SUPERVISOR sees nav entry + page renders
 *   - the table renders the seeded users (V20/V21/V22)
 *   - text search narrows the list
 *   - role filter narrows the list
 *   - active filter narrows the list (lawyer_inactive_fi must appear under "معطَّل فقط")
 */
test.describe('Admin Users — list & filters', () => {
  test('CENTRAL_SUPERVISOR sees the admin nav and the users table', async ({ page }) => {
    await loginAs(page, 'admin');

    // Nav entry visible only for CENTRAL_SUPERVISOR.
    const adminLink = page.getByRole('link', { name: /إدارة المستخدمين/ }).first();
    await expect(adminLink).toBeVisible();
    await adminLink.click();

    await expect(page).toHaveURL(/\/admin\/users(\?|$)/);
    await expect(page.getByTestId('admin-users-page')).toBeVisible();
    await expect(page.getByTestId('admin-users-table')).toBeVisible();
    // Seed has more than just `admin` — make sure several rows render.
    const rowCount = await page.locator('[data-testid="admin-users-table"] tbody tr').count();
    expect(rowCount).toBeGreaterThan(3);
  });

  test('text search narrows the list to a single user', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');

    await page.getByTestId('admin-users-q').fill('section_fi_dam');
    await page.getByRole('button', { name: /^تطبيق$/ }).click();

    // Wait for the list to settle: the table re-renders synchronously after
    // the query refetches — assert on the row content.
    const rows = page.locator('[data-testid="admin-users-table"] tbody tr');
    await expect(rows.first()).toContainText('section_fi_dam', { timeout: 10_000 });
    expect(await rows.count()).toBeLessThanOrEqual(2);
  });

  test('role filter = STATE_LAWYER returns only state lawyers', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');

    await page.getByLabel('filter-role').selectOption('STATE_LAWYER');
    const rows = page.locator('[data-testid="admin-users-table"] tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2); // lawyer_fi_dam + lawyer2_fi_dam at least
    // Each visible row's role column should contain "محامي" (Arabic label for STATE_LAWYER).
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText(/محامي/);
    }
  });

  test('active=false filter surfaces the inactive seeded lawyer', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');

    await page.getByLabel('filter-active').selectOption('false');
    const rows = page.locator('[data-testid="admin-users-table"] tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    // V21 seeded `lawyer_inactive_fi` as active=false.
    await expect(page.locator('[data-testid="admin-users-table"]')).toContainText('lawyer_inactive_fi');
  });
});

