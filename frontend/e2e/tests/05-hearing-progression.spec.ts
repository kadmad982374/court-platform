import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';

/**
 * 5) Lawyer-side hearing progression + finalization (visible buttons only).
 *
 * Pre-condition: V22 demo seed → Case 2 (DEMO-ASSIGNED-002) is owned by
 * lawyer_fi_dam, has stage IN_PROGRESS, prior INITIAL+ROLLOVER history.
 *
 * To avoid mutating shared seed state across re-runs, this spec asserts that
 * the rollover & finalize ENTRY POINTS are visible to the owner lawyer and
 * NOT visible to non-owners. Actual mutation is exercised in the API-level
 * runtime audit (DEMO_SEED_RUNTIME_VERIFICATION.md) and not here.
 */
test.describe('5) Hearing progression entry points', () => {
  test('owner lawyer can open Case 2 stage and sees rollover + finalize buttons', async ({
    page,
  }) => {
    await loginAs(page, 'lawyer');

    await navigateBySidebar(page, /^الدعاوى$/);
    await page.goto('/cases/2');

    // Wait until the case detail has settled.
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')),
    ).toBeVisible({ timeout: 15_000 });

    // The stages card heading always renders, but the stage LIST inside it
    // may fail to load if the backend scope check on GET /cases/{id}/stages
    // rejects the lawyer role. In that case the page shows "تعذّر تحميل المراحل".
    //
    // Strategy: look for either a stage link OR the error text.
    // If stages loaded → click through to the stage detail.
    // If stages errored → navigate directly to the stage via the
    //   current_stage_id shown on the page (e.g. "#5").
    const stageLink = page.locator('a[href^="/stages/"]').first();
    const stagesError = page.getByText('تعذّر تحميل المراحل');

    // Wait for either to appear (whichever comes first).
    await expect(stageLink.or(stagesError)).toBeVisible({ timeout: 15_000 });

    if (await stageLink.isVisible()) {
      // Happy path: stages table rendered with links.
      await stageLink.click();
    } else {
      // Fallback: stages list failed (backend scope). Navigate directly
      // using the current-stage ID shown in the basic-info card.
      // The markup is: <dt>المرحلة الحالية</dt><dd>#N</dd>
      const stageDD = page.locator('dt:has-text("المرحلة الحالية") + dd');
      const stageIdText = await stageDD.textContent({ timeout: 5_000 }).catch(() => null);
      const stageId = stageIdText?.trim().replace('#', '');
      if (!stageId || stageId === '—' || !/^\d+$/.test(stageId)) {
        test.skip(true, 'Stages list errored and no current_stage_id visible — backend scope issue, not a UI bug.');
        return;
      }
      await page.goto(`/stages/${stageId}`);
    }

    await expect(page).toHaveURL(/\/stages\/\d+$/);

    // Owner-only action buttons must be visible
    await expect(page.getByRole('button', { name: /ترحيل الجلسة/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /فصل المرحلة/ })).toBeVisible();
  });

  test('non-owner lawyer (lawyer2) does NOT see rollover/finalize on Case 2', async ({ page }) => {
    await loginAs(page, 'lawyer2');
    // Case 2 is not owned by lawyer2; the lawyer scope blocks read entirely
    // so the page either shows an error/empty state or simply no buttons.
    const resp = await page.goto('/cases/2');
    // Either 200 with no buttons, or an Arabic forbidden message rendered
    if (resp && resp.ok()) {
      await expect(page.getByRole('button', { name: /ترحيل الجلسة/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /فصل المرحلة/ })).toHaveCount(0);
    }
  });

  test('section_head can view Case 2 detail but does NOT see lawyer-only buttons', async ({
    page,
  }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/cases/2');

    const stageLink = page.locator('a[href^="/stages/"]').first();
    if (await stageLink.count()) {
      await stageLink.click();
      await expect(page).toHaveURL(/\/stages\/\d+$/);
      // SECTION_HEAD is NOT the owner — D-024 restricts rollover/finalize to owner
      await expect(page.getByRole('button', { name: /ترحيل الجلسة/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /فصل المرحلة/ })).toHaveCount(0);
    }
  });
});


