import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';

/**
 * 7) Execution module.
 *
 * Pre-condition: V22 demo seed → 1 execution file (EX-DEMO-004) on Case 4.
 */
test.describe('7) Execution files', () => {
  test('section_head sees execution-files list and opens detail', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /^التنفيذ$/);
    await expect(page).toHaveURL(/\/execution-files/);

    // The page might render a table OR an empty state. After V22 there's >= 1 file.
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    // Click the row's open-button (rendered via navigate handler)
    await firstRow.getByRole('button').first().click();
    await expect(page).toHaveURL(/\/execution-files\/\d+$/);
  });

  test('lawyer can also reach execution module top page', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await navigateBySidebar(page, /^التنفيذ$/);
    await expect(page).toHaveURL(/\/execution-files/);
  });
});

