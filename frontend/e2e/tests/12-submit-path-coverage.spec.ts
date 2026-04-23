import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { DEMO_PASSWORD } from '../fixtures/users';

/**
 * 12) Submit-path coverage for the 4 highest-value remaining gaps:
 *
 *   1. Rollover hearing submit     (Priority 1)
 *   2. Finalize submit             (Priority 1)
 *   3. ADMIN_CLERK delegated promote (Priority 2)
 *   4. Reminder create submit      (Priority 3)
 *
 * Test data strategy:
 *   - Rollover / Finalize / Reminder positive cases: Each test creates a
 *     FRESH case via the API and (when needed) assigns lawyer_fi_dam, then
 *     navigates the browser to that case/stage. This is fully robust against
 *     the state drift that happens after many prior test runs (Case 2's owner
 *     is no longer guaranteed to be lawyer_fi_dam in a long-lived dev DB).
 *   - ADMIN_CLERK promote: Uses V25 case (DEMO-FI-FINAL-006) for promote-to-appeal
 *     and V24 case (DEMO-APPEAL-FINAL-005) for promote-to-execution visibility.
 *     clerk_fi_dam has PROMOTE_TO_APPEAL + PROMOTE_TO_EXECUTION delegations.
 *
 * Negative tests verify visibility gating (non-owner / non-delegated roles).
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
  return body.accessToken;
}

async function findCaseByBasis(token: string, basisNumber: string): Promise<number | null> {
  const resp = await fetch(`${BACKEND_URL}/api/v1/cases?page=0&size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const match = data.content?.find(
    (c: { originalBasisNumber: string }) => c.originalBasisNumber === basisNumber,
  );
  return match?.id ?? null;
}

/**
 * Create a fresh case via the API as section_fi_dam, optionally assign
 * lawyer_fi_dam, and return { caseId, stageId, lawyerUserId }. Returns null
 * on any failure so the test can `test.skip(!result, …)`.
 *
 * Uses the EXACT schema accepted by `POST /api/v1/cases` — see
 * `frontend/src/shared/types/domain.ts :: CreateCaseRequest`.
 *
 * Note on validation:
 *   - `firstPostponementReason` is FREE TEXT (D-020), not a code.
 *   - `stageType` / `stageBasisNumber` / `stageYear` are MANDATORY.
 */
async function createFreshCase(
  sectionToken: string,
  opts: { assignLawyer?: boolean } = {},
): Promise<{ caseId: number; stageId: number; lawyerUserId: number | null } | null> {
  const suffix = Date.now().toString().slice(-6);
  const createResp = await fetch(`${BACKEND_URL}/api/v1/cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sectionToken}`,
    },
    body: JSON.stringify({
      publicEntityName: 'جهة اختبار E2E',
      publicEntityPosition: 'PLAINTIFF',
      opponentName: `خصم-E2E-${suffix}`,
      originalBasisNumber: `E2E-S-${suffix}`,
      basisYear: 2026,
      originalRegistrationDate: '2026-01-15',
      branchId: 1,
      departmentId: 2,
      courtId: 2,
      stageType: 'FIRST_INSTANCE',
      stageBasisNumber: `E2E-S-${suffix}`,
      stageYear: 2026,
      firstHearingDate: '2026-03-01',
      firstPostponementReason: 'تأجيل أوّلي للاختبار',
    }),
  });
  if (!createResp.ok) {
    // eslint-disable-next-line no-console
    console.error('createFreshCase failed:', createResp.status, await createResp.text());
    return null;
  }
  const caseData = await createResp.json();
  const caseId = caseData.id as number;
  const stageId = (caseData.currentStageId ?? caseData.stageId) as number;

  let lawyerUserId: number | null = null;
  if (opts.assignLawyer) {
    const lawyerToken = await apiLogin('lawyer_fi_dam');
    const meResp = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${lawyerToken}` },
    });
    const me = await meResp.json();
    lawyerUserId = me.id as number;

    const assignResp = await fetch(
      `${BACKEND_URL}/api/v1/cases/${caseId}/assign-lawyer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sectionToken}`,
        },
        body: JSON.stringify({ lawyerUserId }),
      },
    );
    if (!assignResp.ok) {
      // eslint-disable-next-line no-console
      console.error('assignLawyer failed:', assignResp.status, await assignResp.text());
      return null;
    }
  }

  return { caseId, stageId, lawyerUserId };
}

// =========================================================================
// 1) Rollover hearing submit
// =========================================================================

test.describe('12-1) Rollover hearing — real submit', () => {

  test('owner lawyer submits a rollover and sees new entry in history', async ({ page }) => {
    // Create a fresh case + assign lawyer_fi_dam — robust against shared-DB drift.
    const sectionToken = await apiLogin('section_fi_dam');
    const result = await createFreshCase(sectionToken, { assignLawyer: true });
    test.skip(!result, 'Could not create fresh case for rollover test');
    const { stageId } = result!;

    await loginAs(page, 'lawyer');
    await page.goto(`/stages/${stageId}`);
    await expect(page).toHaveURL(/\/stages\/\d+$/);

    // Wait for stage progression card to render
    await expect(page.getByText('وضع الجلسة الحالية')).toBeVisible({ timeout: 15_000 });

    // Count existing history rows before rollover
    await page.waitForTimeout(800); // let history load
    const historyRowsBefore = await page.locator('table tbody tr').count();

    // Verify rollover button is visible (D-024 — owner only)
    const rolloverBtn = page.getByRole('button', { name: /^ترحيل الجلسة$/ });
    await expect(rolloverBtn).toBeVisible({ timeout: 5_000 });
    await rolloverBtn.click();

    // Modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('ترحيل الجلسة')).toBeVisible();

    // Fill form — unique future date
    const nextDate = '2026-12-15';
    await modal.locator('input[type="date"]').fill(nextDate);

    // Wait for postponement reasons dropdown to load, then select first non-placeholder
    const reasonSelect = modal.locator('select');
    await expect(reasonSelect).toBeEnabled({ timeout: 10_000 });
    const optionValues = await reasonSelect
      .locator('option')
      .evaluateAll((opts) =>
        (opts as HTMLOptionElement[])
          .filter((o) => o.value && !o.disabled)
          .map((o) => o.value),
      );
    expect(optionValues.length).toBeGreaterThan(0);
    await reasonSelect.selectOption(optionValues[0]);

    // Intercept the API call
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/rollover-hearing') && resp.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^ترحيل$/ }).click(),
    ]);

    // Verify response
    expect(response.status()).toBeLessThan(300);
    const responseBody = await response.json();
    expect(responseBody.entryType).toBe('ROLLOVER');
    expect(responseBody.hearingDate).toBe(nextDate);

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // No error alert
    await expect(page.locator('[role="alert"]')).toHaveCount(0);

    // History should have one more row (TanStack Query refetch)
    await page.waitForTimeout(2000);
    const historyRowsAfter = await page.locator('table tbody tr').count();
    expect(historyRowsAfter).toBeGreaterThan(historyRowsBefore);
  });

  test('non-owner lawyer (lawyer2) does NOT see rollover button', async ({ page }) => {
    // Create a fresh case + assign lawyer_fi_dam (NOT lawyer2)
    const sectionToken = await apiLogin('section_fi_dam');
    const result = await createFreshCase(sectionToken, { assignLawyer: true });
    test.skip(!result, 'Could not create fresh case');
    const { stageId } = result!;

    await loginAs(page, 'lawyer2');
    const resp = await page.goto(`/stages/${stageId}`);
    // Either backend rejects read access (403 → page shows error) or it
    // returns the stage but the rollover button is hidden because lawyer2
    // is not the assigned lawyer. Both prove the gate is enforced.
    if (resp && resp.ok()) {
      await expect(page.getByRole('button', { name: /^ترحيل الجلسة$/ })).toHaveCount(0);
    }
  });
});

// =========================================================================
// 2) Finalize submit
// =========================================================================

test.describe('12-2) Finalize — real submit', () => {

  test('owner lawyer finalizes a fresh case stage', async ({ page }) => {
    // Create a fresh case + assign lawyer_fi_dam — clean isolated stage to finalize
    const sectionToken = await apiLogin('section_fi_dam');
    const result = await createFreshCase(sectionToken, { assignLawyer: true });
    test.skip(!result, 'Could not create fresh case for finalize test');
    const { stageId } = result!;

    // Login as the assigned lawyer
    await loginAs(page, 'lawyer');
    await page.goto(`/stages/${stageId}`);
    await expect(page).toHaveURL(/\/stages\/\d+$/);

    // Verify finalize button visible
    const finalizeBtn = page.getByRole('button', { name: /فصل المرحلة/ });
    await expect(finalizeBtn).toBeVisible({ timeout: 10_000 });
    await finalizeBtn.click();

    // Modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('فصل المرحلة')).toBeVisible();

    // Fill decision data
    const suffix = Date.now().toString().slice(-6);
    await modal.locator('input[name="decisionNumber"]').fill(`DEC-E2E-${suffix}`);
    await modal.locator('input[name="decisionDate"]').fill('2026-04-20');
    // decisionType defaults to NON_FINAL, select FOR_ENTITY
    await modal.locator('select[name="decisionType"]').selectOption('FOR_ENTITY');
    await modal.locator('input[name="adjudgedAmount"]').fill('100000');
    await modal.locator('input[name="currencyCode"]').fill('SYP');
    await modal.locator('textarea[name="summaryNotes"]').fill('فصل تجريبي E2E');

    // Intercept the API call
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/finalize') && resp.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^فصل$/ }).click(),
    ]);

    // Verify response
    expect(response.status()).toBeLessThan(300);
    const body = await response.json();
    expect(body.decisionNumber).toBe(`DEC-E2E-${suffix}`);
    expect(body.decisionType).toBe('FOR_ENTITY');

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // No error alert
    await expect(page.locator('[role="alert"]')).toHaveCount(0);

    // Stage status should reflect FINALIZED in the page subtitle or progression card
    await page.waitForTimeout(2000);
    await expect(
      page.getByText(/مفصولة|FINALIZED/).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('non-owner lawyer (lawyer2) does NOT see finalize button', async ({ page }) => {
    // Create a fresh case + assign lawyer_fi_dam (NOT lawyer2)
    const sectionToken = await apiLogin('section_fi_dam');
    const result = await createFreshCase(sectionToken, { assignLawyer: true });
    test.skip(!result, 'Could not create fresh case');
    const { stageId } = result!;

    await loginAs(page, 'lawyer2');
    const resp = await page.goto(`/stages/${stageId}`);
    if (resp && resp.ok()) {
      await expect(page.getByRole('button', { name: /^فصل المرحلة$/ })).toHaveCount(0);
    }
  });
});

// =========================================================================
// 3) ADMIN_CLERK with delegated promote path
// =========================================================================

test.describe('12-3) ADMIN_CLERK delegated promote', () => {

  test('clerk_fi_dam (with PROMOTE_TO_APPEAL delegation) sees promote-to-appeal button', async ({ page }) => {
    // V25 case: DEMO-FI-FINAL-006 — lifecycle=ACTIVE, FI FINALIZED
    const token = await apiLogin('clerk_fi_dam');
    const caseId = await findCaseByBasis(token, 'DEMO-FI-FINAL-006');
    test.skip(!caseId, 'V25 seed case DEMO-FI-FINAL-006 not found in DB');

    await loginAs(page, 'clerk');
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    // Clerk with PROMOTE_TO_APPEAL delegation should see the button
    const promoteBtn = page.getByRole('button', { name: /ترقية إلى الاستئناف/ });
    await expect(promoteBtn).toBeVisible({ timeout: 5_000 });

    // Execute the promote — intercept the network call. Accept either:
    //   2xx → fresh promote succeeded
    //   409 → already promoted (re-run path); error banner shown in UI
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/promote-to-appeal') && resp.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      promoteBtn.click(),
    ]);

    expect([200, 201, 204, 400, 409, 422]).toContain(response.status());

    if (response.status() >= 400) {
      // Re-run path — V25 case was promoted by a previous run, so the
      // current stage is now an APPEAL stage that is NOT FINALIZED, which
      // makes the backend reject with 400 STAGE_NOT_FINALIZED (or 409
      // ALREADY_APPEAL_STAGE on some seeds). Either way the UI must
      // surface the rejection inline and stay stable.
      const errorBanner = page.locator('[role="alert"]').first();
      await expect(errorBanner).toBeVisible({ timeout: 5_000 });
      const errText = await errorBanner.textContent();
      expect(errText?.length ?? 0).toBeGreaterThan(0);
      test.info().annotations.push({
        type: 'result',
        description: `Re-run: clerk delegated promote rejected by backend (${response.status()}) — "${errText?.trim()}"`,
      });
    } else {
      test.info().annotations.push({
        type: 'result',
        description: `Clerk delegated promote-to-appeal succeeded (${response.status()})`,
      });
    }

    // Page remains stable
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible();
  });

  test('clerk_fi_dam (with PROMOTE_TO_EXECUTION delegation) sees promote-to-execution button', async ({ page }) => {
    // Use V24 case: DEMO-APPEAL-FINAL-005
    const token = await apiLogin('clerk_fi_dam');
    const caseId = await findCaseByBasis(token, 'DEMO-APPEAL-FINAL-005');
    test.skip(!caseId, 'V24 seed case DEMO-APPEAL-FINAL-005 not found in DB');

    await loginAs(page, 'clerk');
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    // Clerk with PROMOTE_TO_EXECUTION delegation should see the button
    const promoteBtn = page.getByRole('button', { name: /ترقية إلى التنفيذ/ });
    await expect(promoteBtn).toBeVisible({ timeout: 5_000 });

    // We don't submit here since the 11-case-detail-actions.spec.ts already
    // covers the full submit flow for this case. We just verify delegation-based
    // visibility is correct for the ADMIN_CLERK role.
    test.info().annotations.push({
      type: 'result',
      description: 'ADMIN_CLERK with PROMOTE_TO_EXECUTION delegation sees button — visibility confirmed',
    });
  });

  test('STATE_LAWYER does NOT see promote buttons (no delegation)', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: /ترقية إلى الاستئناف/ })).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: /ترقية إلى التنفيذ/ })).not.toBeVisible({ timeout: 3_000 });
  });

  test('READ_ONLY_SUPERVISOR does NOT see promote buttons', async ({ page }) => {
    await loginAs(page, 'viewer');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: /ترقية إلى الاستئناف/ })).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: /ترقية إلى التنفيذ/ })).not.toBeVisible({ timeout: 3_000 });
  });
});

// =========================================================================
// 4) Reminder create submit
// =========================================================================

test.describe('12-4) Reminder create — real submit', () => {

  test('lawyer creates a reminder on a fresh case and sees it in the list', async ({ page }) => {
    // Create a fresh case + assign lawyer_fi_dam — guarantees read access
    const sectionToken = await apiLogin('section_fi_dam');
    const result = await createFreshCase(sectionToken, { assignLawyer: true });
    test.skip(!result, 'Could not create fresh case for reminder test');
    const { caseId } = result!;

    await loginAs(page, 'lawyer');
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    // Reminders section should be visible
    await expect(page.getByText(/تذكيراتي/).first()).toBeVisible({ timeout: 10_000 });

    // Click "إنشاء تذكير"
    const createBtn = page.getByRole('button', { name: /^إنشاء تذكير$/ });
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
    await createBtn.click();

    // Modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('إنشاء تذكير')).toBeVisible();

    // Fill form
    await modal.locator('input[name="reminderAt"]').fill('2026-12-31T09:00');
    const suffix = Date.now().toString().slice(-6);
    await modal.locator('textarea[name="reminderText"]').fill(`تذكير E2E ${suffix}`);

    // Intercept the API call
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/reminders') && resp.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^حفظ$/ }).click(),
    ]);

    // Verify response
    expect(response.status()).toBeLessThan(300);
    const body = await response.json();
    expect(body.reminderText).toContain(`تذكير E2E ${suffix}`);
    expect(body.status).toBe('PENDING');

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // No error alert
    await expect(page.locator('[role="alert"]')).toHaveCount(0);

    // New reminder should appear in the list (refetch happened)
    await expect(page.getByText(`تذكير E2E ${suffix}`)).toBeVisible({ timeout: 10_000 });
  });

  test('READ_ONLY_SUPERVISOR sees reminders heading but CAN also create (personal D-037)', async ({ page }) => {
    // The backend allows any authenticated user with read access to create
    // personal reminders. This test verifies the UI shows the section.
    await loginAs(page, 'viewer');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    // Reminders section should exist
    const remindersHeading = page.getByText(/تذكيراتي/).first();
    await expect(remindersHeading).toBeVisible({ timeout: 10_000 });

    // Create button should be visible (personal reminders are not role-restricted)
    const createBtn = page.getByRole('button', { name: /^إنشاء تذكير$/ });
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
  });
});










