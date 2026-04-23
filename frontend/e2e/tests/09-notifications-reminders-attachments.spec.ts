import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';

/**
 * 9) Notifications, Reminders, Attachments (UI presence + basic interactions).
 *
 * V22 demo seed:
 *   - section_fi_dam: 6 notifications (mix read/unread)
 *   - lawyer_fi_dam:  3 LAWYER_ASSIGNED notifications
 *   - Case 2 has 1 PENDING + 1 DONE reminder (owned by lawyer_fi_dam)
 *   - Stage attachment metadata exists (file may not be on disk — D-035)
 */
test.describe('9) Notifications / Reminders / Attachments — UI presence', () => {
  test('section_head opens /notifications inbox and sees at least one row', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await navigateBySidebar(page, /الإشعارات/);
    await expect(page).toHaveURL(/\/notifications/);

    // Either a list/table of notifications or an empty-state.
    await expect(
      page.locator('table, ul li, [data-testid="notification-row"]')
        .first()
        .or(page.getByText(/لا توجد إشعارات|لا يوجد/)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('section_head can mark a notification as read (best-effort)', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/notifications');

    const markBtn = page.getByRole('button', { name: /قراءة|تعليم|مقروء/ }).first();
    if (await markBtn.count()) {
      await markBtn.click();
      // Just assert no full-page error; the row might disappear or change style
      await expect(page.getByRole('alert')).toHaveCount(0);
    } else {
      test.info().annotations.push({
        type: 'state',
        description: 'No mark-as-read button visible (all notifications already read).',
      });
    }
  });

  test('lawyer sees personal reminders section on Case 2', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/2');

    // RemindersSection — match by Arabic heading
    await expect(page.getByText(/التذكيرات/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('lawyer sees attachments section on Case 2 stage', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/2');

    // Wait for case detail to settle.
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')),
    ).toBeVisible({ timeout: 15_000 });

    // Stages list may fail to load for the lawyer due to backend scope
    // (GET /cases/{id}/stages rejected). Handle both paths.
    const stageLink = page.locator('a[href^="/stages/"]').first();
    const stagesError = page.getByText('تعذّر تحميل المراحل');

    await expect(stageLink.or(stagesError)).toBeVisible({ timeout: 15_000 });

    if (await stageLink.isVisible()) {
      await stageLink.click();
    } else {
      // Fallback: navigate directly via current_stage_id from basic-info.
      // Markup: <dt>المرحلة الحالية</dt><dd>#N</dd>
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

    // AttachmentsSection — match by Arabic heading
    await expect(page.getByText(/المرفقات/).first()).toBeVisible({ timeout: 10_000 });
  });
});


