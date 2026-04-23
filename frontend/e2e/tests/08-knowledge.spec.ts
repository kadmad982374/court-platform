import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';

/**
 * 8) Knowledge directory (Phase 7) — read-only pages, D-042.
 */
test.describe('8) Knowledge directory pages', () => {
  test('legal library list + first item detail', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /المكتبة القانونية/);
    await expect(page).toHaveURL(/\/legal-library/);

    const firstItem = page.locator('a[href^="/legal-library/items/"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10_000 });
    await firstItem.click();
    await expect(page).toHaveURL(/\/legal-library\/items\/\d+/);
  });

  test('public entities list + first detail', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /دليل الجهات العامة/);
    await expect(page).toHaveURL(/\/public-entities/);

    const firstItem = page.locator('a[href^="/public-entities/"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10_000 });
    await firstItem.click();
    await expect(page).toHaveURL(/\/public-entities\/\d+/);
  });

  test('circulars list + first detail', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /^التعاميم$/);
    await expect(page).toHaveURL(/\/circulars/);

    const firstItem = page.locator('a[href^="/circulars/"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10_000 });
    await firstItem.click();
    await expect(page).toHaveURL(/\/circulars\/\d+/);
  });
});

