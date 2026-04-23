import { type Page, expect } from '@playwright/test';
import { loginAs } from '../../../fixtures/auth';
import type { UserKey } from '../../../fixtures/users';
import { AR, URL } from '../_selectors';

/**
 * Logs in as the given role-key and validates the AppShell is fully mounted.
 * Returns assertion helpers scoped to the current page.
 *
 * Used by every per-role spec to keep boilerplate at zero.
 */
export async function openAs(page: Page, who: UserKey) {
  const user = await loginAs(page, who);

  // After login, the user lands on /dashboard|cases|profile.
  // We assert the sidebar is mounted (loginAs already does that)
  // plus assert the URL is one of the expected ones.
  await expect(page).toHaveURL(/\/(dashboard|cases|profile)/);

  return {
    user,

    /** Assert a sidebar nav link is visible by Arabic accessible name. */
    async expectNavVisible(name: RegExp) {
      await expect(page.getByRole('link', { name }).first()).toBeVisible();
    },

    /** Smoke-check ALL canonical sidebar links are mounted. */
    async expectFullSidebar() {
      const labels = [
        AR.navHome, AR.navProfile, AR.navNotifications, AR.navCases,
        AR.navResolved, AR.navExecution, AR.navLegalLibrary,
        AR.navPublicEntities, AR.navCirculars,
      ];
      for (const l of labels) {
        await expect(page.getByRole('link', { name: l }).first()).toBeVisible();
      }
    },

    /** Navigate to a page and assert the URL settles. */
    async go(path: string, expectedRe?: RegExp) {
      await page.goto(path);
      await expect(page).toHaveURL(expectedRe ?? new RegExp(path.replace('/', '\\/') + '($|\\?|/)'));
    },
  };
}

/** Time-based unique suffix (last 6 digits of epoch ms). */
export function uniq(): string {
  return Date.now().toString().slice(-6);
}

export { URL };

