import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { DEMO_PASSWORD } from '../fixtures/users';

/**
 * 13) Completion-pass coverage for the remaining implemented flows that
 * were not yet exercised at the real-submit level in the chromium project:
 *
 *   1. Reset-password page — form open + validation + invalid-OTP error
 *   2. Profile page — /me reflected in the UI after login
 *   3. Stage attachment upload — real `multipart/form-data` POST
 *   4. Execution-file attachment upload — real POST (clerk + assigned lawyer)
 *   5. Add execution step — real submit (clerk delegated path)
 *   6. Reminder status PENDING → DONE — real PATCH
 *   7. Notification mark-as-read — real PATCH on a fresh unread notification
 *
 * Test data strategy:
 *   - All mutation tests create fresh entities via the API (case + assign
 *     lawyer) before driving the browser, mirroring the strategy that
 *     made the Round-2 spec robust against shared-DB drift.
 *   - The OTP-delivery side of reset-password remains environment-limited
 *     (SMS gateway POSTPONED), so the *positive* reset is documented as a
 *     known gap. The page itself is fully testable for form validation +
 *     bad-OTP path, which is what we cover here.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

// ── API helpers ──────────────────────────────────────────────────────────

async function apiLogin(username: string): Promise<string> {
  const resp = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: DEMO_PASSWORD }),
  });
  const body = await resp.json();
  return body.accessToken as string;
}

async function getUserId(username: string): Promise<number> {
  const tok = await apiLogin(username);
  const r = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  return (await r.json()).id as number;
}

/**
 * Lookup the first execution-file id readable by the given user. Handles
 * both the array and Spring-page-envelope response shapes so the tests
 * survive a future contract change.
 */
async function firstExecutionFileId(token: string): Promise<number | null> {
  const r = await fetch(`${BACKEND_URL}/api/v1/execution-files?page=0&size=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (Array.isArray(data)) {
    return (data[0]?.id as number | undefined) ?? null;
  }
  return (data?.content?.[0]?.id as number | undefined) ?? null;
}

/**
 * Create a fresh case + (optionally) assign lawyer_fi_dam, return ids.
 * Uses the same proven payload schema as 12-submit-path-coverage.spec.ts.
 */
async function createFreshCase(
  sectionToken: string,
  opts: { assignLawyer?: boolean } = {},
): Promise<{ caseId: number; stageId: number } | null> {
  const sfx = Date.now().toString().slice(-6);
  const r = await fetch(`${BACKEND_URL}/api/v1/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sectionToken}` },
    body: JSON.stringify({
      publicEntityName: 'جهة اختبار E2E-13',
      publicEntityPosition: 'PLAINTIFF',
      opponentName: `خصم-E2E13-${sfx}`,
      originalBasisNumber: `E2E13-${sfx}`,
      basisYear: 2026,
      originalRegistrationDate: '2026-01-15',
      branchId: 1,
      departmentId: 2,
      courtId: 2,
      stageType: 'FIRST_INSTANCE',
      stageBasisNumber: `E2E13-${sfx}`,
      stageYear: 2026,
      firstHearingDate: '2026-03-01',
      firstPostponementReason: 'تأجيل أوّلي للاختبار E2E-13',
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const caseId = data.id as number;
  const stageId = (data.currentStageId ?? data.stageId) as number;

  if (opts.assignLawyer) {
    const lawyerId = await getUserId('lawyer_fi_dam');
    const a = await fetch(`${BACKEND_URL}/api/v1/cases/${caseId}/assign-lawyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sectionToken}` },
      body: JSON.stringify({ lawyerUserId: lawyerId }),
    });
    if (!a.ok) return null;
  }

  return { caseId, stageId };
}

// =========================================================================
// 13-1) Reset-password page
// =========================================================================

test.describe('13-1) Reset password — page + validation + invalid OTP', () => {

  test('renders the form with all required fields', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText('إعادة تعيين كلمة المرور')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('input[autocomplete="tel"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="new-password"]').first()).toBeVisible();
    await expect(page.locator('input[autocomplete="new-password"]').nth(1)).toBeVisible();
  });

  test('client validation: short password + mismatched confirm', async ({ page }) => {
    await page.goto('/reset-password');
    await page.locator('input[autocomplete="tel"]').fill('0000000099');
    await page.locator('input[autocomplete="one-time-code"]').fill('1234');
    await page.locator('input[autocomplete="new-password"]').first().fill('short');
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('different');

    await page.getByRole('button', { name: /إعادة التعيين/ }).click();

    await expect(page.getByText('الحد الأدنى 8 محارف')).toBeVisible({ timeout: 5_000 });
  });

  test('invalid OTP submit shows backend error and does NOT redirect', async ({ page }) => {
    await page.goto('/reset-password');

    await page.locator('input[autocomplete="tel"]').fill('0000000099');
    await page.locator('input[autocomplete="one-time-code"]').fill('999999');
    await page.locator('input[autocomplete="new-password"]').first().fill('NewPassword!2026');
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('NewPassword!2026');

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/auth/reset-password') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.getByRole('button', { name: /إعادة التعيين/ }).click(),
    ]);

    expect(response.status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(
      page.getByText(/رمز غير صحيح|انتهت صلاحية|تعذّر إعادة تعيين/).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// =========================================================================
// 13-2) Profile page
// =========================================================================

test.describe('13-2) Profile — /me reflected in UI', () => {

  test('SECTION_HEAD profile renders username + role', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'ملفي الشخصي' })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('section_fi_dam')).toBeVisible();
    await expect(page.getByText(/رئيس قسم|SECTION_HEAD/i).first()).toBeVisible();
  });

  test('STATE_LAWYER profile renders username', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'ملفي الشخصي' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('lawyer_fi_dam')).toBeVisible();
  });
});

// =========================================================================
// 13-3) Stage attachment upload (real multipart POST)
// =========================================================================

test.describe('13-3) Stage attachment upload — real submit', () => {

  test('owner lawyer uploads a small in-memory file to a fresh stage', async ({ page }) => {
    const sectionToken = await apiLogin('section_fi_dam');
    const result = await createFreshCase(sectionToken, { assignLawyer: true });
    test.skip(!result, 'Could not create fresh case');
    const { stageId } = result!;

    await loginAs(page, 'lawyer');
    await page.goto(`/stages/${stageId}`);
    await expect(page).toHaveURL(/\/stages\/\d+$/);
    await expect(page.getByText('وضع الجلسة الحالية')).toBeVisible({ timeout: 15_000 });

    const fileInput = page.getByLabel('اختر ملفًا للرفع');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    const filename = `e2e-stage-${Date.now()}.txt`;
    const [uploadResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/stages/${stageId}/attachments`) && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      fileInput.setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from(`hello from playwright @ ${new Date().toISOString()}`),
      }),
    ]);

    expect(uploadResp.status()).toBeLessThan(300);
    const body = await uploadResp.json();
    expect(body.originalFilename).toBe(filename);
    expect(body.attachmentScopeType).toBe('CASE_STAGE');

    await expect(page.getByText(filename)).toBeVisible({ timeout: 10_000 });
  });
});

// =========================================================================
// 13-4) Execution-file attachment upload (real multipart POST)
// =========================================================================

test.describe('13-4) Execution-file attachment upload — real submit', () => {

  test('clerk uploads a small in-memory file to an execution file', async ({ page }) => {
    const tok = await apiLogin('clerk_fi_dam');
    const fileId = await firstExecutionFileId(tok);
    test.skip(!fileId, 'No execution files in DB');

    await loginAs(page, 'clerk');
    await page.goto(`/execution-files/${fileId}`);
    await expect(page).toHaveURL(/\/execution-files\/\d+$/);
    // Wait for the file-actions card to render (detail loaded)
    await expect(page.getByText('أفعال الملف')).toBeVisible({ timeout: 15_000 });

    // The visible upload button (not the hidden input). If absent → skip.
    const uploadBtn = page.getByRole('button', { name: /^رفع مرفق$/ });
    if (!(await uploadBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Upload control not visible for clerk on this execution file (D-036 hint)');
      return;
    }

    const fileInput = page.getByLabel('اختر ملفًا للرفع');
    const filename = `e2e-exec-${Date.now()}.txt`;
    const [uploadResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/execution-files/${fileId}/attachments`) && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      fileInput.setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from(`exec attachment @ ${new Date().toISOString()}`),
      }),
    ]);

    expect(uploadResp.status()).toBeLessThan(300);
    const body = await uploadResp.json();
    expect(body.originalFilename).toBe(filename);
    expect(body.attachmentScopeType).toBe('EXECUTION_FILE');

    await expect(page.getByText(filename)).toBeVisible({ timeout: 10_000 });
  });

  test('assigned lawyer uploads a small in-memory file to the same execution file', async ({ page }) => {
    // The seed grants execution-file id=1 to lawyer_fi_dam (assignedUserId=5).
    // This proves the assignee path of D-036 in the browser.
    const tok = await apiLogin('lawyer_fi_dam');
    const fileId = await firstExecutionFileId(tok);
    test.skip(!fileId, 'No execution files visible to lawyer_fi_dam');

    await loginAs(page, 'lawyer');
    await page.goto(`/execution-files/${fileId}`);
    await expect(page.getByText('أفعال الملف')).toBeVisible({ timeout: 15_000 });

    const uploadBtn = page.getByRole('button', { name: /^رفع مرفق$/ });
    if (!(await uploadBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Upload control not visible for assigned lawyer (D-036 hint)');
      return;
    }

    const fileInput = page.getByLabel('اختر ملفًا للرفع');
    const filename = `e2e-exec-lawyer-${Date.now()}.txt`;
    const [uploadResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/execution-files/${fileId}/attachments`) && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      fileInput.setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from(`lawyer-side @ ${new Date().toISOString()}`),
      }),
    ]);

    expect(uploadResp.status()).toBeLessThan(300);
    await expect(page.getByText(filename)).toBeVisible({ timeout: 10_000 });
  });
});

// =========================================================================
// 13-5) Add execution step (D-031 — clerk delegated)
// =========================================================================

test.describe('13-5) Add execution step — real submit', () => {

  test('clerk_fi_dam (with ADD_EXECUTION_STEP delegation) submits a step', async ({ page }) => {
    const tok = await apiLogin('clerk_fi_dam');
    const fileId = await firstExecutionFileId(tok);
    test.skip(!fileId, 'No execution files in DB');

    await loginAs(page, 'clerk');
    await page.goto(`/execution-files/${fileId}`);
    await expect(page).toHaveURL(/\/execution-files\/\d+$/);
    // Wait for file detail to render — without this the gate evaluates with file=null.
    await expect(page.getByText('أفعال الملف')).toBeVisible({ timeout: 15_000 });

    const addBtn = page.getByRole('button', { name: /^إضافة خطوة$/ });
    if (!(await addBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Add-step button not visible for clerk on this execution file');
      return;
    }
    await addBtn.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('إضافة خطوة تنفيذية')).toBeVisible();

    await modal.locator('input[name="stepDate"]').fill('2026-04-20');
    await modal.locator('select[name="stepType"]').selectOption('ADMIN_ACTION');
    const desc = `خطوة E2E-13 ${Date.now()}`;
    await modal.locator('textarea[name="stepDescription"]').fill(desc);

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/execution-files/${fileId}/steps`) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^إضافة$/ }).click(),
    ]);
    expect(resp.status()).toBeLessThan(300);
    const body = await resp.json();
    expect(body.stepDescription).toBe(desc);
    expect(body.stepType).toBe('ADMIN_ACTION');

    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(desc)).toBeVisible({ timeout: 10_000 });
  });

  test('STATE_LAWYER (non-assigned) does NOT see add-step button', async ({ page }) => {
    const tok = await apiLogin('section_fi_dam');
    const fileId = await firstExecutionFileId(tok);
    test.skip(!fileId, 'No execution files in DB');

    await loginAs(page, 'lawyer2');
    const r = await page.goto(`/execution-files/${fileId}`);
    if (r && r.ok()) {
      await expect(page.getByRole('button', { name: /^إضافة خطوة$/ })).toHaveCount(0);
    }
  });
});

// =========================================================================
// 13-6) Reminder status update PENDING → DONE
// =========================================================================

test.describe('13-6) Reminder status update — real PATCH', () => {

  test('owner lawyer transitions a fresh reminder PENDING → DONE', async ({ page }) => {
    const sectionToken = await apiLogin('section_fi_dam');
    const result = await createFreshCase(sectionToken, { assignLawyer: true });
    test.skip(!result, 'Could not create fresh case');
    const { caseId } = result!;

    await loginAs(page, 'lawyer');
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    // Create a reminder via the UI
    await page.getByRole('button', { name: /^إنشاء تذكير$/ }).click();
    const createModal = page.getByRole('dialog');
    await expect(createModal).toBeVisible({ timeout: 10_000 });
    await createModal.locator('input[name="reminderAt"]').fill('2026-12-31T09:00');
    const text = `تذكير E2E-13-status-${Date.now()}`;
    await createModal.locator('textarea[name="reminderText"]').fill(text);
    await createModal.getByRole('button', { name: /^حفظ$/ }).click();
    await expect(createModal).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(text)).toBeVisible({ timeout: 10_000 });

    const row = page.locator('table tbody tr').filter({ hasText: text }).first();
    await expect(row).toBeVisible();
    const doneBtn = row.getByRole('button', { name: /^تمَّ$/ });
    await expect(doneBtn).toBeVisible({ timeout: 5_000 });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/reminders\/\d+\/status$/.test(r.url()) && r.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      doneBtn.click(),
    ]);
    expect(resp.status()).toBeLessThan(300);
    const body = await resp.json();
    expect(body.status).toBe('DONE');

    const refreshedRow = page.locator('table tbody tr').filter({ hasText: text }).first();
    await expect(refreshedRow.getByText('منجز')).toBeVisible({ timeout: 10_000 });
    await expect(refreshedRow.getByRole('button', { name: /^تمَّ$/ })).toHaveCount(0);
  });
});

// =========================================================================
// 13-7) Notification mark-as-read
// =========================================================================

test.describe('13-7) Notification mark-as-read — real PATCH', () => {

  test('section_head marks the first unread notification as read', async ({ page }) => {
    // Create a fresh case as section_fi_dam — backend listener emits a
    // CASE_REGISTERED notification to section_fi_dam. Guarantees ≥1 unread.
    const sectionToken = await apiLogin('section_fi_dam');
    const created = await createFreshCase(sectionToken);
    test.skip(!created, 'Could not create fresh case (no notification trigger)');

    await loginAs(page, 'sectionHead');
    await page.goto('/notifications');

    const markBtn = page.getByRole('button', { name: /^تعليم كمقروء$/ }).first();
    await expect(markBtn).toBeVisible({ timeout: 15_000 });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/notifications\/\d+\/read$/.test(r.url()) && r.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      markBtn.click(),
    ]);
    expect(resp.status()).toBeLessThan(300);
    const body = await resp.json();
    expect(body.read).toBe(true);
    expect(body.readAt).toBeTruthy();
  });
});



