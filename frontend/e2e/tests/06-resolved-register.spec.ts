import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';
import { fieldByLabel } from '../fixtures/dom';

/**
 * 6) Resolved register page.
 *
 * Pre-condition: V22 demo seed → at least 1 finalized case in Apr/Jun 2026.
 *
 * NOTE: The page uses the custom <Field label="..."> wrapper that does NOT
 * set htmlFor, so getByLabel() does not work — we use fieldByLabel().
 */
test.describe('6) Resolved register', () => {
  test('section_head opens resolved register and filters by 2026/04', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /سجل الفصل/);
    await expect(page).toHaveURL(/\/resolved-register/);

    await fieldByLabel(page, 'السنة').fill('2026');
    await fieldByLabel(page, 'الشهر (1-12)').fill('4');

    // Apply button: the form has a submit button labelled "تطبيق"
    await page.getByRole('button', { name: /^تطبيق$/ }).click();

    // Result table or empty-state must be visible
    await expect(
      page.locator('table').or(page.getByText(/لا توجد|لا يوجد/)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('viewer (read-only) can also browse the register', async ({ page }) => {
    await loginAs(page, 'viewer');
    await navigateBySidebar(page, /سجل الفصل/);
    await expect(page).toHaveURL(/\/resolved-register/);
    await expect(fieldByLabel(page, 'السنة')).toBeVisible();
  });
});


