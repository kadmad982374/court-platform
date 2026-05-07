import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';
import { fieldByLabel } from '../fixtures/dom';

/**
 * Scenario: SECTION_HEAD creates a fresh case via the real UI.
 *
 * Pre-condition: V22 demo seed applied → section_fi_dam has memberships in
 * (Damascus / FIRST_INSTANCE) and that branch has at least one court.
 *
 * The test uses a unique stage-basis number so it never collides on re-runs.
 *
 * NOTE on selectors: the app's `Field` component renders `<label>{text}</label>`
 * WITHOUT `htmlFor` association, so `getByLabel` does not work. We use the
 * `fieldByLabel(page, "...")` helper which walks the DOM from label → input.
 */
test.describe('3) Create case (SECTION_HEAD path)', () => {
  test('section_head can create a new case end-to-end', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /^الدعاوى$/);
    await expect(page).toHaveURL(/\/cases$/);

    // Open create form via the toolbar button
    await page.getByRole('button', { name: /إنشاء دعوى/ }).click();
    await expect(page).toHaveURL(/\/cases\/new$/);

    // PR-15a iter 4 (customer feedback): a single-section section head no longer
    // sees branch/department/stage-type pickers — they're auto-locked to the
    // user's section. Only the court picker remains. Plus the legal entity
    // position select. Court is now `select.nth(1)` (after publicEntityPosition).
    // Fall back: if the dropdowns ARE visible (mode != lockedSectionHead),
    // pick the first non-empty option for each.
    const allSelects = page.locator('select');
    const totalSelects = await allSelects.count();
    if (totalSelects >= 4) {
      // Old layout — full picker set still visible.
      const branchSelect = allSelects.nth(0);
      await branchSelect.selectOption(
        (await branchSelect.locator('option').nth(1).getAttribute('value'))!,
      );
      const departmentSelect = allSelects.nth(1);
      await expect(departmentSelect.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
      await departmentSelect.selectOption(
        (await departmentSelect.locator('option').nth(1).getAttribute('value'))!,
      );
      const courtSelect = allSelects.nth(3);
      await expect(courtSelect.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
      await courtSelect.selectOption(
        (await courtSelect.locator('option').nth(1).getAttribute('value'))!,
      );
    } else {
      // Locked section-head layout — only publicEntityPosition + court.
      const courtSelect = page.locator('label:has-text("المحكمة")')
        .locator('xpath=following::select[1]');
      await expect(courtSelect.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
      await courtSelect.selectOption(
        (await courtSelect.locator('option').nth(1).getAttribute('value'))!,
      );
    }

    // Fill text fields
    const unique = Date.now().toString().slice(-6);

    // The app's <Field> wrapper renders <label> WITHOUT htmlFor, so
    // page.getByLabel() can't associate; use fieldByLabel walker instead.
    await fieldByLabel(page, 'اسم الجهة العامة').fill('وزارة الاختبار E2E');
    await fieldByLabel(page, 'اسم الخصم').fill('شركة الاختبار E2E');
    await fieldByLabel(page, 'رقم الأساس').fill(`E2E-O-${unique}`);
    await fieldByLabel(page, 'تاريخ تسجيل الملف').fill('2026-01-15');
    await fieldByLabel(page, 'رقم أساس الدعوى').fill(`E2E-S-${unique}`);
    await fieldByLabel(page, 'تاريخ الجلسة الأولى').fill('2026-06-01');
    await fieldByLabel(page, 'سبب التأجيل الأول').fill('سبب اختبار E2E');

    // Submit
    await page.getByRole('button', { name: /قيد الدعوى/ }).click();

    // On success backend returns case → navigate('/cases/:id')
    await page.waitForURL(/\/cases\/\d+$/, { timeout: 20_000 });

    // Sanity: case detail page renders with our entity name
    await expect(page.getByText('وزارة الاختبار E2E').first()).toBeVisible({ timeout: 10_000 });
  });

  test('viewer (read-only) sees the disabled-message variant of CreateCasePage', async ({
    page,
  }) => {
    await loginAs(page, 'viewer');
    await page.goto('/cases/new');
    await expect(page.getByText(/لا تملك صلاحية إنشاء دعوى/)).toBeVisible();
  });

  test('lawyer is also blocked at the page level', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/new');
    await expect(page.getByText(/لا تملك صلاحية إنشاء دعوى/)).toBeVisible();
  });
});


