import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';
import type { UserKey } from '../../fixtures/users';

/**
 * Admin Users — negative access (route guard + nav visibility).
 *
 * The route `/admin/users` is wrapped in `RequireAuth anyOf={['CENTRAL_SUPERVISOR']}`
 * which redirects to `/dashboard`. The sidebar entry "إدارة المستخدمين" is
 * filtered by `visibleItems()` to CENTRAL_SUPERVISOR only.
 *
 * For each non-admin role we assert:
 *   - the admin-users sidebar link is NOT rendered
 *   - direct navigation to /admin/users redirects away (lands on /dashboard)
 */
const NON_ADMIN_ROLES: UserKey[] = [
  'branchHead',
  'sectionHead',
  'clerk',
  'clerkNoAssign',
  'lawyer',
  'lawyer2',
  'viewer',
];

for (const who of NON_ADMIN_ROLES) {
  test.describe(`Admin Users — gating for ${who}`, () => {
    test(`${who}: no sidebar entry + direct nav redirects`, async ({ page }) => {
      await loginAs(page, who);

      // Sidebar entry must not be present.
      const adminLink = page.getByRole('link', { name: /^إدارة المستخدمين$/ });
      await expect(adminLink).toHaveCount(0);

      // Direct navigation must NOT land on /admin/users.
      await page.goto('/admin/users');
      await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 10_000 });
      // Specifically lands on /dashboard per RequireAuth behaviour.
      await expect(page).toHaveURL(/\/dashboard/);
      // The admin page testid must NOT be in the DOM.
      await expect(page.getByTestId('admin-users-page')).toHaveCount(0);
    });
  });
}

