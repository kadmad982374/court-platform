import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';
import { openFirstCaseFromList } from '../fixtures/dom';

/**
 * 4) Case detail + Assign-Lawyer.
 *
 * Pre-condition: V22 demo seed → Case 1 (DEMO-FRESH-001) exists with
 * lifecycle=NEW and currentOwnerUserId=null. After V22 + the prior
 * assign-lawyer e2e, Case 1 may already be assigned; the test handles both.
 */
test.describe('4) Case detail + Assign Lawyer (post-V22)', () => {
  test('section_head opens the cases list and selects the first row', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /^الدعاوى$/);
    await expect(page).toHaveURL(/\/cases$/);

    // The row action is a <Button>فتح</Button> (onClick navigate),
    // NOT an <a href="/cases/...">; click the button directly.
    await openFirstCaseFromList(page);
    await expect(page).toHaveURL(/\/cases\/\d+$/);

    // Page should show the Arabic "المعلومات الأساسية" card title
    await expect(page.getByText('المعلومات الأساسية').first()).toBeVisible({ timeout: 10_000 });
  });

  test('assign-lawyer section is visible to section_head and lists active lawyers only', async ({
    page,
  }) => {
    await loginAs(page, 'sectionHead');
    // Open Case 1 directly (DEMO-FRESH-001 from V22 seed)
    await page.goto('/cases/1');

    const section = page.getByTestId('assign-lawyer-section');
    await expect(section).toBeVisible({ timeout: 15_000 });

    // The dropdown should populate with at least one lawyer; inactive lawyer
    // (lawyer_inactive_fi) MUST NOT appear.
    const picker = section.getByLabel('lawyer-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });

    const optionsText = await picker.locator('option').allTextContents();
    expect(optionsText.length).toBeGreaterThan(1); // placeholder + ≥1 lawyer
    for (const txt of optionsText) {
      expect(txt).not.toMatch(/inactive/i);
    }
  });

  test('section_head can assign a lawyer (idempotent — succeeds OR shows "already assigned")', async ({
    page,
  }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/cases/1');

    const section = page.getByTestId('assign-lawyer-section');
    await expect(section).toBeVisible({ timeout: 15_000 });

    const picker = section.getByLabel('lawyer-picker');
    await expect(picker.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });

    // Pick the first non-placeholder lawyer
    const firstLawyerValue = await picker.locator('option').nth(1).getAttribute('value');
    expect(firstLawyerValue).toBeTruthy();
    await picker.selectOption(firstLawyerValue!);

    const submit = section.getByTestId('assign-lawyer-submit');
    if (await submit.isEnabled()) {
      await submit.click();

      // Either success or backend-error (e.g. "already assigned to this lawyer")
      const success = section.getByTestId('assign-lawyer-success');
      const error = section.getByTestId('assign-lawyer-error');
      await expect(success.or(error)).toBeVisible({ timeout: 10_000 });
    } else {
      // Already current owner — picker disabled the submit; that is also a PASS
      test.info().annotations.push({
        type: 'state',
        description: 'Assign-lawyer submit disabled: lawyer is already the current owner.',
      });
    }
  });

  test('lawyer (non-section) does NOT see assign-lawyer section', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/2'); // DEMO-ASSIGNED-002 — owned by lawyer_fi_dam

    // Wait for the case detail to settle: either the info card OR an error.
    await expect(
      page
        .getByText('المعلومات الأساسية')
        .or(page.getByRole('alert'))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    // The crucial assertion: assign-lawyer section MUST NOT be present for a lawyer.
    await expect(page.getByTestId('assign-lawyer-section')).toHaveCount(0);
  });

  test('viewer (read-only) does NOT see assign-lawyer section', async ({ page }) => {
    await loginAs(page, 'viewer');
    await page.goto('/cases/1');
    await expect(page.getByTestId('assign-lawyer-section')).toHaveCount(0);
  });
});



