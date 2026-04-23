import { type Page, expect } from '@playwright/test';
import { USERS, type UserKey, type DemoUser } from './users';

/**
 * Logs the given user in via the real login form and waits until the
 * dashboard is mounted. Uses stable id selectors (#username, #password)
 * present in `LoginPage.tsx`.
 */
export async function loginAs(page: Page, who: UserKey | DemoUser): Promise<DemoUser> {
  const user: DemoUser = typeof who === 'string' ? USERS[who] : who;

  await page.goto('/login');
  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: /دخول/ }).click();

  // Step 1 — confirm we are *authenticated*: the AppShell header always
  // renders the logout button once /users/me resolves, regardless of which
  // roles came back. This is the canonical "auth landed" signal and it does
  // NOT depend on the user carrying any role, so it cannot lie about login.
  await expect(
    page.getByRole('button', { name: 'تسجيل الخروج' }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/login(\?|$)/);

  // Step 2 — confirm the user actually carries roles, otherwise the entire
  // sidebar collapses (every NAV_ITEM in `navItems.ts` gates on
  // `allowedRoles`, even `الصفحة الرئيسية` which uses `ALL_ROLES`). When
  // this fails we surface the *actual* state observed in the page so the
  // failure isn't a cryptic "selector not found" but a concrete
  // "user X authenticated with roles=[]". That almost always points at the
  // DB seed (V20) being out of sync — V20's `IF v_user_X IS NULL` guard
  // will NOT restore a wiped `user_roles` link on subsequent boots.
  const homeLink = page.getByRole('link', { name: /الصفحة الرئيسية/ }).first();
  try {
    await expect(homeLink).toBeVisible({ timeout: 15_000 });
  } catch (err) {
    const dashboardRoles = await page
      .getByText(/^الأدوار:/)
      .first()
      .textContent({ timeout: 1_000 })
      .catch(() => '<no dashboard roles label>');
    throw new Error(
      `loginAs(${user.username}): authenticated (logout button is visible) ` +
        `but the sidebar collapsed — /users/me returned a user with no roles ` +
        `the FE recognises. Dashboard reports: "${dashboardRoles?.trim()}". ` +
        `Check the DB:\n` +
        `  SELECT u.username, r.type FROM users u\n` +
        `   LEFT JOIN user_roles ur ON ur.user_id = u.id\n` +
        `   LEFT JOIN roles r       ON r.id      = ur.role_id\n` +
        `   WHERE u.username = '${user.username}';\n` +
        `If the row is missing, V20's role-link insert was skipped because ` +
        `the user already existed; restoring it (or making the V20 INSERT ` +
        `unconditional + ON CONFLICT DO NOTHING) is the real fix.\n\n` +
        `Original assertion error: ${(err as Error).message}`,
    );
  }

  return user;
}

/**
 * Logs out by clearing the auth state from localStorage and navigating
 * to /login (matches D-044 — token kept in localStorage behind a Port).
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/login');
}

/**
 * Helpful navigation guard — clicks a sidebar link by its Arabic label.
 */
export async function navigateBySidebar(page: Page, arabicLabel: string | RegExp): Promise<void> {
  const link = page.getByRole('link', { name: arabicLabel }).first();
  await link.click();
}

