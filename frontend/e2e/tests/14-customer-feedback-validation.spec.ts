// PR-8..PR-14 customer-feedback validation suite.
//
// Every test() block exercises one ask from
// `feedback/customer_feedback_analysis.md`. Run against the live
// docker-compose.demo.yml stack:
//
//   E2E_BASE_URL=http://localhost \
//   E2E_BACKEND_URL=http://localhost:8080 \
//   npx playwright test e2e/tests/14-customer-feedback-validation.spec.ts
//
// Runs in headless Chromium against nginx — uses the same fixtures as the
// existing roles/demo specs.

import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth';

async function logout(page: Page) {
  const btn = page.getByRole('button', { name: 'تسجيل الخروج' }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
  }
}

// ────────────────────────────────────────────────────────────
// A — ADMIN
// ────────────────────────────────────────────────────────────

test.describe('A — ADMIN (CENTRAL_SUPERVISOR)', () => {
  test('A-2 / Q-B / Q-F — dashboard pie + adjudged totals + Q-F footnote', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard');

    await expect(page.getByText('إحصائيات الدعاوى').first()).toBeVisible();
    await expect(page.getByText(/مجاميع المبالغ المحكوم بها/).first()).toBeVisible();
    await expect(
      page.getByText(/مبلغ الصلح والمصاريف غير مشمولة/).first(),
    ).toBeVisible();
    await expect(page.locator('.recharts-wrapper svg').first()).toBeVisible();

    // PR-13b: percentage labels now render inside the pie itself (no hover).
    await expect(page.locator('.recharts-wrapper svg text').filter({ hasText: /٪/ }).first())
      .toBeVisible();

    // PR-13b: API slices must be mutually exclusive — sum equals totalCases.
    const summary = await page.evaluate(async () => {
      const r = await fetch('/api/v1/reports/case-summary', {
        headers: {
          Authorization: 'Bearer ' + (localStorage.getItem('sla.accessToken') ?? ''),
        },
      });
      return r.json();
    });
    const sum = Object.values(summary.byCurrentOutcome as Record<string, number>)
      .reduce((a, b) => a + b, 0);
    expect(sum).toBe(summary.totalCases);
  });

  test('A-2 / Q-B — same widget compact on /cases', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/cases');
    await expect(page.getByText('إحصائيات الدعاوى').first()).toBeVisible();
    await expect(page.locator('.recharts-wrapper svg').first()).toBeVisible();
  });

  test('A-3 — admin cases listing has Branch + Department + Court filters', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/cases');
    await expect(page.getByText('الفلاتر').first()).toBeVisible();
    await expect(page.locator('label:has-text("الفرع")').first()).toBeVisible();
    await expect(page.locator('label:has-text("القسم")').first()).toBeVisible();
    await expect(page.locator('label:has-text("المحكمة")').first()).toBeVisible();
  });

  test('A-4 — admin sees reminders read-only, no "إنشاء تذكير" button', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/cases');
    await page.locator('table tbody tr').first().getByRole('button', { name: /^فتح$/ }).click();
    await expect(page).toHaveURL(/\/cases\/\d+/);
    // Reminders section is present (oversight read mode)
    await expect(page.getByText(/تذكيرات المحامي/).first()).toBeVisible();
    // But the "Create reminder" button is NOT shown to admin
    await expect(page.getByRole('button', { name: /إنشاء تذكير/ })).toHaveCount(0);
  });

  test('A-5 — admin can open a case from the resolved register', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/resolved-register');
    // V22 seeds D-2026-003 (Case 3 finalized) → it lives on the resolved register.
    const row = page.locator('table tbody tr').filter({ hasText: 'D-2026-003' });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /^فتح$/ }).click();
    await expect(page).toHaveURL(/\/cases\/\d+/);
    await expect(page.getByText('المراحل').first()).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────
// B — BRANCH_HEAD (head_dam)
// ────────────────────────────────────────────────────────────

test.describe('B — BRANCH_HEAD', () => {
  test('B-1 — cases page exposes department + court (no branch picker)', async ({ page }) => {
    await loginAs(page, 'branchHead');
    await page.goto('/cases');
    await expect(page.locator('label:has-text("القسم")').first()).toBeVisible();
    await expect(page.locator('label:has-text("المحكمة")').first()).toBeVisible();
    // branch picker must NOT render for branch_head
    await expect(page.locator('label:has-text("الفرع")')).toHaveCount(0);
  });

  test('B-2 — actions panel hidden for branch_head on a case', async ({ page }) => {
    await loginAs(page, 'branchHead');
    await page.goto('/cases');
    await page.locator('table tbody tr').first().getByRole('button', { name: /^فتح$/ }).click();
    await expect(page).toHaveURL(/\/cases\/\d+/);
    // PR-8 hides the entire "أفعال على مستوى الدعوى" card for branch_head
    await expect(page.getByText('أفعال على مستوى الدعوى')).toHaveCount(0);
  });

  test('B-3 — resolved-register has dept+court+decision-type, no branch picker', async ({ page }) => {
    await loginAs(page, 'branchHead');
    await page.goto('/resolved-register');
    await expect(page.locator('label:has-text("القسم")').first()).toBeVisible();
    await expect(page.locator('label:has-text("المحكمة")').first()).toBeVisible();
    await expect(page.locator('label:has-text("نوع القرار")').first()).toBeVisible();
    await expect(page.locator('label:has-text("الفرع")')).toHaveCount(0);
  });

  test('B-4 — branch_head can open a case from resolved register', async ({ page }) => {
    await loginAs(page, 'branchHead');
    await page.goto('/resolved-register');
    const row = page.locator('table tbody tr').filter({ hasText: 'D-2026-003' });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /^فتح$/ }).click();
    await expect(page).toHaveURL(/\/cases\/\d+/);
  });

  test('Q-G — branch_head broadcast composer: BRANCH/DEPARTMENT only, no ALL', async ({ page }) => {
    await loginAs(page, 'branchHead');
    await expect(page.getByRole('link', { name: 'إرسال إشعار' })).toBeVisible();
    await page.getByRole('link', { name: 'إرسال إشعار' }).click();
    await expect(page).toHaveURL(/\/notifications\/broadcast/);

    const scope = page.locator('select').first();
    const optionTexts = await scope.locator('option').allTextContents();
    expect(optionTexts.some((t) => /جميع المحامين$/.test(t))).toBe(false); // no "ALL"
    expect(optionTexts.some((t) => /محامي الفرع/.test(t))).toBe(true);
    expect(optionTexts.some((t) => /محامي القسم/.test(t))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// C — SECTION_HEAD (section_fi_dam)
// ────────────────────────────────────────────────────────────

test.describe('C — SECTION_HEAD', () => {
  test('C-1 — section_head cases filters: court only (no branch / no dept)', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/cases');
    await expect(page.locator('label:has-text("المحكمة")').first()).toBeVisible();
    await expect(page.locator('label:has-text("الفرع")')).toHaveCount(0);
    await expect(page.locator('label:has-text("القسم")')).toHaveCount(0);
  });

  test('C-3 — promote-to-execution modal is pre-populated', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/cases');
    // V22 Case 3 (DEMO-FINAL-003) has stage_status=FINALIZED and is_read_only=FALSE.
    // The "ترقية إلى التنفيذ" button on the actions card should appear there.
    const row = page.locator('table tbody tr').filter({ hasText: 'DEMO-FINAL-003' });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /^فتح$/ }).click();

    const promote = page.getByRole('button', { name: /ترقية إلى التنفيذ/ });
    await expect(promote).toBeVisible({ timeout: 10_000 });
    await promote.click();

    const enforcing = page.locator('label:has-text("الجهة المنفِّذة")')
      .locator('xpath=following-sibling::input[1]');
    await expect(enforcing).not.toHaveValue('');
    const fileNo = page.locator('label:has-text("رقم الملف التنفيذي")')
      .locator('xpath=following-sibling::input[1]');
    await expect(fileNo).not.toHaveValue('');
  });

  test('C-5 — resolved-register section_head: year/month/court/decisionType only', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/resolved-register');
    await expect(page.locator('label:has-text("السنة")').first()).toBeVisible();
    await expect(page.locator('label:has-text("المحكمة")').first()).toBeVisible();
    await expect(page.locator('label:has-text("نوع القرار")').first()).toBeVisible();
    await expect(page.locator('label:has-text("الفرع")')).toHaveCount(0);
    await expect(page.locator('label:has-text("القسم")')).toHaveCount(0);
  });

  test('C-6 / Q-D — section_head can correct a finalized case', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/cases');
    // V22 seeds DEMO-FINAL-003 with stage_status=FINALIZED and is_read_only=FALSE
    // → the correction button must show on its detail page for section_fi_dam.
    const row = page.locator('table tbody tr').filter({ hasText: 'DEMO-FINAL-003' });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /^فتح$/ }).click();
    await expect(page).toHaveURL(/\/cases\/\d+/);

    const correctBtn = page.getByRole('button', { name: /تصحيح بيانات الدعوى المفصولة/ });
    await expect(correctBtn).toBeVisible({ timeout: 10_000 });
    await correctBtn.click();
    await expect(page.getByRole('heading', { name: /تصحيح بيانات الدعوى المفصولة/ })).toBeVisible();
    // Cancel — we just want to confirm the modal opens with the right shape.
    await page.getByRole('button', { name: /^إلغاء$/ }).first().click();
  });

  test('C-7 — section_head sees execution file row but step timeline is hidden', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/execution-files');
    // V22 seeds EX-DEMO-004 in (DAMASCUS, FI) — section_fi_dam's section. Wait
    // for it explicitly (don't .count()-and-skip; the row IS expected to exist).
    const row = page.locator('table tbody tr').filter({ hasText: 'EX-DEMO-004' });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /^فتح$/ }).click();
    await expect(page).toHaveURL(/\/execution-files\/\d+/);

    // PR-12 (C-7): step timeline + "أفعال الملف" hidden for managers; Arabic
    // explanation shown in their place.
    await expect(page.getByText('الخطوات (الأقدم أولًا)')).toHaveCount(0);
    await expect(page.getByText('أفعال الملف')).toHaveCount(0);
    await expect(page.getByText(/مقصور على المحامي المُسنَد للملف/).first()).toBeVisible();
  });

  test('Q-G — section_head broadcast composer: DEPARTMENT only', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/notifications/broadcast');
    const scope = page.locator('select').first();
    const opts = await scope.locator('option').allTextContents();
    expect(opts.some((t) => /محامي الفرع/.test(t))).toBe(false);  // no BRANCH
    expect(opts.some((t) => /محامي القسم/.test(t))).toBe(true);
    expect(opts.some((t) => /^محامون مختارون$/.test(t.trim()))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// D — ADMIN_CLERK (clerk_fi_dam)
// ────────────────────────────────────────────────────────────

test.describe('D — ADMIN_CLERK', () => {
  test('D-1 — clerk cases filters: same as section_head (court only)', async ({ page }) => {
    await loginAs(page, 'clerk');
    await page.goto('/cases');
    await expect(page.locator('label:has-text("المحكمة")').first()).toBeVisible();
    await expect(page.locator('label:has-text("الفرع")')).toHaveCount(0);
    await expect(page.locator('label:has-text("القسم")')).toHaveCount(0);
  });

  test('D-2 / Q-E — clerk does NOT see "إرسال إشعار" sidebar entry', async ({ page }) => {
    await loginAs(page, 'clerk');
    await expect(page.getByRole('link', { name: 'إرسال إشعار' })).toHaveCount(0);
  });

  test('D-2 / Q-E — clerk on execution file: no add-step button, no step timeline', async ({ page }) => {
    await loginAs(page, 'clerk');
    await page.goto('/execution-files');
    const row = page.locator('table tbody tr').filter({ hasText: 'EX-DEMO-004' });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /^فتح$/ }).click();
    await expect(page).toHaveURL(/\/execution-files\/\d+/);
    await expect(page.getByText('الخطوات (الأقدم أولًا)')).toHaveCount(0);
    await expect(page.getByText('أفعال الملف')).toHaveCount(0);
  });
});

// ────────────────────────────────────────────────────────────
// E — EXECUTION DEPT (any role probing the page)
// ────────────────────────────────────────────────────────────

test.describe('E — EXECUTION', () => {
  test('E-2 / Q-A — execution-files page exposes "المنطقة (المحكمة)" filter', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/execution-files');
    await expect(page.locator('label:has-text("المنطقة (المحكمة)")').first()).toBeVisible();
  });

  test('E-3 — sidebar has "الملفات المنفّذة" pre-applying status=CLOSED', async ({ page }) => {
    await loginAs(page, 'admin');
    const link = page.getByRole('link', { name: 'الملفات المنفّذة' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/execution-files\?status=CLOSED/);
    await expect(page.getByRole('heading', { name: 'الملفات المنفّذة' })).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────
// Q-G fan-out — section sends, lawyer receives
// ────────────────────────────────────────────────────────────

test.describe('Q-G — fan-out', () => {
  const subject = `اختبار E2E ${Date.now()}`;

  test('section_head sends DEPARTMENT broadcast', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/notifications/broadcast');

    // Default scope for section_head is DEPARTMENT — branch+dept locked.
    await page.locator('label:has-text("العنوان")')
      .locator('xpath=following-sibling::input[1]').fill(subject);
    await page.locator('label:has-text("النص")')
      .locator('xpath=following-sibling::textarea[1]').fill('رسالة من اختبار E2E');

    await page.getByRole('button', { name: /^إرسال$/ }).click();
    // After submit, we navigate to /notifications.
    await expect(page).toHaveURL(/\/notifications(\?|$)/);
  });

  test('lawyer receives the broadcast in the inbox', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/notifications');
    await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
  });
});
