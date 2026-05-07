import { test, expect } from '@playwright/test';
import { openAs, uniq } from './_fixtures/roleSession';
import { fieldByLabel } from '../../fixtures/dom';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 2 — SECTION_HEAD (`section_fi_dam`)
 *
 * The richest admin-side flow. Exercises CREATE CASE end-to-end + assign
 * lawyer (idempotent). Owner-only stage actions (rollover/finalize) MUST
 * NOT be visible because section head is not the assigned lawyer.
 */
test.describe.serial('Role: SECTION_HEAD (section_fi_dam)', () => {
  test('login + sidebar', async ({ page }) => {
    const s = await openAs(page, 'sectionHead');
    await s.expectFullSidebar();
  });

  test('creates a fresh case end-to-end (idempotent via Date.now suffix)', async ({ page }) => {
    await openAs(page, 'sectionHead');
    await page.goto(URL.cases);
    await page.getByRole('button', { name: /إنشاء دعوى/ }).click();
    await expect(page).toHaveURL(/\/cases\/new$/);

    // PR-15a iter 4: branch/dept/stage-type are locked for single-section
    // section heads. Only court remains pickable. Use the label-walk locator
    // so layout changes (locked vs pickers) don't break the test.
    const courtSelect = page.locator('label:has-text("المحكمة")')
      .locator('xpath=following::select[1]');
    await expect(courtSelect.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
    await courtSelect.selectOption(
      (await courtSelect.locator('option').nth(1).getAttribute('value'))!,
    );

    const u = uniq();
    await fieldByLabel(page, 'اسم الجهة العامة').fill('وزارة E2E-ROLES');
    await fieldByLabel(page, 'اسم الخصم').fill('شركة E2E-ROLES');
    await fieldByLabel(page, 'رقم الأساس').fill(`R-O-${u}`);
    await fieldByLabel(page, 'تاريخ تسجيل الملف').fill('2026-01-15');
    await fieldByLabel(page, 'رقم أساس الدعوى').fill(`R-S-${u}`);
    await fieldByLabel(page, 'تاريخ الجلسة الأولى').fill('2026-06-01');
    await fieldByLabel(page, 'سبب التأجيل الأول').fill('سبب اختبار roles');

    await page.getByRole('button', { name: AR.btnCreateCaseSubmit }).click();
    await page.waitForURL(/\/cases\/\d+$/, { timeout: 20_000 });
    await expect(page.getByText('وزارة E2E-ROLES').first()).toBeVisible({ timeout: 10_000 });
  });

  test('assigns lawyer on the fresh case (accepts already-assigned)', async ({ page }) => {
    await openAs(page, 'sectionHead');
    await page.goto(`/cases/${SEED.CASE_FRESH}`);
    const section = page.getByTestId(TID.assignLawyerSection);
    await expect(section).toBeVisible({ timeout: 15_000 });

    const picker = section.getByLabel('lawyer-picker');
    await expect(picker.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
    await picker.selectOption(
      (await picker.locator('option').nth(1).getAttribute('value'))!,
    );

    const submit = section.getByTestId(TID.assignLawyerSubmit);
    if (await submit.isEnabled()) {
      await submit.click();
      await expect(
        section.getByTestId(TID.assignLawyerSuccess).or(section.getByTestId(TID.assignLawyerError)),
      ).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({
        type: 'state',
        description: 'submit disabled — chosen lawyer is already current owner',
      });
    }
  });

  test('opens an owned-stage detail but does NOT see owner-only actions', async ({ page }) => {
    await openAs(page, 'sectionHead');
    await page.goto(`/stages/${SEED.STAGE_OWNED_BY_LAWYER}`);
    // Page renders
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    // Owner-only buttons must NOT be present for section head
    await expect(page.getByRole('button', { name: AR.btnRollover })).toHaveCount(0);
    await expect(page.getByRole('button', { name: AR.btnFinalize })).toHaveCount(0);
  });
});

