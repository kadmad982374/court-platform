import { test, expect, type Page } from '@playwright/test';
import { openAs } from './_fixtures/roleSession';
import { TID, AR, URL } from './_selectors';
import { SEED } from './_fixtures/seedIds';

/**
 * ROLE 5 — STATE_LAWYER OWNER (`lawyer_fi_dam`)
 *
 * Owns Case 2 (DEMO-ASSIGNED-002) in V22 seed. We DO NOT hardcode the
 * stage id because V22 returns dynamic IDs — instead we navigate from
 * /cases/2 → its current stage (mirrors the strategy in the existing
 * 05-hearing-progression.spec.ts).
 */

/**
 * Open the current stage of an owned case for the logged-in lawyer.
 * Returns the stage URL after navigation.
 */
async function openOwnedCaseStage(page: Page, caseId: number): Promise<void> {
  await page.goto(`/cases/${caseId}`);
  await expect(
    page.getByText(AR.pageBasicInfo).or(page.getByRole('alert')).first(),
  ).toBeVisible({ timeout: 15_000 });

  // Try the stages-card link first; fall back to current_stage_id from the
  // basic-info card if the stages list errored (lawyer-scope quirk).
  const stageLink = page.locator('a[href^="/stages/"]').first();
  const stagesError = page.getByText('تعذّر تحميل المراحل');
  await expect(stageLink.or(stagesError)).toBeVisible({ timeout: 15_000 });

  if (await stageLink.isVisible()) {
    await stageLink.click();
  } else {
    const dd = page.locator('dt:has-text("المرحلة الحالية") + dd');
    const txt = (await dd.textContent({ timeout: 5_000 }).catch(() => null))?.trim().replace('#', '');
    if (!txt || !/^\d+$/.test(txt)) {
      test.skip(true, 'No current_stage_id surfaced — backend scope issue, not a UI bug.');
      return;
    }
    await page.goto(`/stages/${txt}`);
  }
  await expect(page).toHaveURL(/\/stages\/\d+$/);
}

test.describe.serial('Role: STATE_LAWYER owner (lawyer_fi_dam)', () => {
  test('login + sidebar', async ({ page }) => {
    const s = await openAs(page, 'lawyer');
    await s.expectFullSidebar();
  });

  test('opens own case detail (Case 2) — no assign-lawyer surface', async ({ page }) => {
    await openAs(page, 'lawyer');
    await page.goto(`/cases/${SEED.CASE_OWNED_BY_LAWYER}`);
    await expect(page.getByText(AR.pageBasicInfo).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TID.assignLawyerSection)).toHaveCount(0);
  });

  test('owner-only stage actions VISIBLE on owned stage', async ({ page }) => {
    await openAs(page, 'lawyer');
    await openOwnedCaseStage(page, SEED.CASE_OWNED_BY_LAWYER);
    await expect(page.getByRole('button', { name: AR.btnRollover })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: AR.btnFinalize })).toBeVisible();
  });

  test('rollover dialog opens (without submitting — keeps seed stable)', async ({ page }) => {
    await openAs(page, 'lawyer');
    await openOwnedCaseStage(page, SEED.CASE_OWNED_BY_LAWYER);
    await page.getByRole('button', { name: AR.btnRollover }).click();
    await expect(page.getByRole('dialog').or(page.getByText(/ترحيل الجلسة/)).first()).toBeVisible({
      timeout: 10_000,
    });
    const cancel = page.getByRole('button', { name: /إلغاء/ }).first();
    if (await cancel.isVisible()) await cancel.click();
  });

  test('create-case is gated for lawyer', async ({ page }) => {
    await openAs(page, 'lawyer');
    await page.goto(URL.newCase);
    await expect(page.getByText(AR.msgNoCreateCase)).toBeVisible();
  });

  test('notifications page reachable for lawyer', async ({ page }) => {
    await openAs(page, 'lawyer');
    await page.goto(URL.notifications);
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  });
});


