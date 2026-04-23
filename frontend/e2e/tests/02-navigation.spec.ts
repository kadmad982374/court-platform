import { test, expect } from '@playwright/test';
import { loginAs, navigateBySidebar } from '../fixtures/auth';

test.describe('2) Sidebar navigation across roles', () => {
  test('section_head sees all expected sidebar entries', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    const labels = [
      'الصفحة الرئيسية',
      'ملفي الشخصي',
      'الدعاوى',
      'سجل الفصل',
      'التنفيذ',
      'المكتبة القانونية',
      'دليل الجهات العامة',
      'التعاميم',
      'الإشعارات',
    ];
    for (const label of labels) {
      await expect(page.getByRole('link', { name: label }).first()).toBeVisible();
    }
  });

  test('navigates section_head → cases → resolved-register → execution-files', async ({
    page,
  }) => {
    await loginAs(page, 'sectionHead');

    await navigateBySidebar(page, /^الدعاوى$/);
    await expect(page).toHaveURL(/\/cases$/);

    await navigateBySidebar(page, /سجل الفصل/);
    await expect(page).toHaveURL(/\/resolved-register/);

    await navigateBySidebar(page, /^التنفيذ$/);
    await expect(page).toHaveURL(/\/execution-files/);
  });

  test('viewer (read-only) can browse cases list and knowledge', async ({ page }) => {
    await loginAs(page, 'viewer');
    await navigateBySidebar(page, /^الدعاوى$/);
    await expect(page).toHaveURL(/\/cases$/);

    await navigateBySidebar(page, /المكتبة القانونية/);
    await expect(page).toHaveURL(/\/legal-library/);
  });

  test('lawyer can reach cases and notifications', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await navigateBySidebar(page, /^الدعاوى$/);
    await expect(page).toHaveURL(/\/cases$/);

    await navigateBySidebar(page, /الإشعارات/);
    await expect(page).toHaveURL(/\/notifications/);
  });
});

