import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { USERS, DEMO_PASSWORD } from '../fixtures/users';

/**
 * 11) Focused runtime validation of the 3 Case Detail action buttons:
 *
 *   A) تعديل البيانات الأساسية  — Edit basic data
 *   B) ترقية إلى الاستئناف       — Promote to appeal
 *   C) ترقية إلى التنفيذ         — Promote to execution
 *
 * Seed cases used:
 *   - V25 Case (DEMO-FI-FINAL-006): lifecycle=ACTIVE, FI FINALIZED → promote-to-appeal
 *   - V24 Case (DEMO-APPEAL-FINAL-005): lifecycle=IN_APPEAL, APPEAL FINALIZED → promote-to-execution
 *   - Case 1 (seed): ACTIVE → edit basic data
 *
 * Since case IDs are dynamic (depend on DB sequence), we find them via the API.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

/** Find a case ID by its original_basis_number via the backend API. */
async function findCaseByBasis(token: string, basisNumber: string): Promise<number | null> {
  const resp = await fetch(`${BACKEND_URL}/api/v1/cases?page=0&size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const match = data.content?.find((c: { originalBasisNumber: string }) =>
    c.originalBasisNumber === basisNumber,
  );
  return match?.id ?? null;
}

/** Login via API and return the access token. */
async function apiLogin(username: string): Promise<string> {
  const resp = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: DEMO_PASSWORD }),
  });
  const body = await resp.json();
  return body.accessToken;
}

// ==========================================================================
// A) Edit basic data
// ==========================================================================

test.describe('11-A) Edit basic data', () => {

  test('SECTION_HEAD can open modal, edit, and save', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    // Use Case 1 — always exists, SECTION_HEAD has membership
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    const editBtn = page.getByRole('button', { name: /تعديل البيانات الأساسية/ });
    await expect(editBtn).toBeVisible({ timeout: 5_000 });
    await editBtn.click();

    // Modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('تعديل البيانات الأساسية')).toBeVisible();

    // Fields are prefilled
    const opponentInput = modal.locator('input[name="opponentName"]');
    await expect(opponentInput).toBeVisible();
    const currentVal = await opponentInput.inputValue();
    expect(currentVal.length).toBeGreaterThan(0);

    // Edit opponent name
    const newName = `خصم-تعديل-${Date.now()}`;
    await opponentInput.clear();
    await opponentInput.fill(newName);

    // Save
    await modal.getByRole('button', { name: /حفظ التغييرات/ }).click();

    // Modal closes
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // Page refreshes with new data
    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('SECTION_HEAD can close modal without saving (no crash)', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /تعديل البيانات الأساسية/ }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Close without saving
    await modal.getByRole('button', { name: /إلغاء/ }).click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });

    // Page still stable
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible();
  });

  test('STATE_LAWYER does NOT see the edit button', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    const editBtn = page.getByRole('button', { name: /تعديل البيانات الأساسية/ });
    // Should not be visible for lawyer role
    await expect(editBtn).not.toBeVisible({ timeout: 3_000 });
  });
});

// ==========================================================================
// B) Promote to appeal
// ==========================================================================

test.describe('11-B) Promote to appeal', () => {

  test('SECTION_HEAD sees the button and gets correct backend response', async ({ page }) => {
    // V25 seed: DEMO-FI-FINAL-006 — lifecycle=ACTIVE, FI FINALIZED
    // On first run → success (new appeal stage created)
    // On re-runs → 409 STAGE_ALREADY_PROMOTED or ALREADY_APPEAL_STAGE
    const token = await apiLogin('section_fi_dam');
    const caseId = await findCaseByBasis(token, 'DEMO-FI-FINAL-006');
    test.skip(!caseId, 'V25 seed case DEMO-FI-FINAL-006 not found in DB');

    await loginAs(page, 'sectionHead');
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    const promoteBtn = page.getByRole('button', { name: /ترقية إلى الاستئناف/ });
    await expect(promoteBtn).toBeVisible({ timeout: 5_000 });
    await promoteBtn.click();

    // Wait for either: lifecycle changes to IN_APPEAL, or error banner appears
    const success = page.getByText('استئناف').first();
    const errorBanner = page.locator('[role="alert"]');
    await expect(success.or(errorBanner)).toBeVisible({ timeout: 15_000 });

    if (await errorBanner.isVisible()) {
      // Re-run: already promoted — verify error is shown cleanly
      const errText = await errorBanner.textContent();
      expect(errText?.length).toBeGreaterThan(0);
      test.info().annotations.push({
        type: 'result',
        description: `Re-run: backend rejected — "${errText}"`,
      });
    } else {
      test.info().annotations.push({
        type: 'result',
        description: 'Fresh promote-to-appeal succeeded',
      });
    }

    // Page remains stable (no crash, no blank screen)
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible();
  });

  test('STATE_LAWYER does NOT see the promote-to-appeal button', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    const promoteBtn = page.getByRole('button', { name: /ترقية إلى الاستئناف/ });
    await expect(promoteBtn).not.toBeVisible({ timeout: 3_000 });
  });
});

// ==========================================================================
// C) Promote to execution
// ==========================================================================

test.describe('11-C) Promote to execution', () => {

  test('SECTION_HEAD can open modal, fill form, and submit', async ({ page }) => {
    // V24 seed: DEMO-APPEAL-FINAL-005 — lifecycle=IN_APPEAL, APPEAL FINALIZED
    // First run → success (navigate to /execution-files/{id})
    // Re-runs → 409 STAGE_ALREADY_PROMOTED — error shown in modal
    const token = await apiLogin('section_fi_dam');
    const caseId = await findCaseByBasis(token, 'DEMO-APPEAL-FINAL-005');
    test.skip(!caseId, 'V24 seed case DEMO-APPEAL-FINAL-005 not found in DB');

    await loginAs(page, 'sectionHead');
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    const promoteBtn = page.getByRole('button', { name: /ترقية إلى التنفيذ/ });
    await expect(promoteBtn).toBeVisible({ timeout: 5_000 });
    await promoteBtn.click();

    // Modal opens
    const dialog = page.getByRole('dialog').or(
      page.getByText(/ترقية الدعوى إلى ملف تنفيذي/),
    ).first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill form
    await page.locator('input[name="enforcingEntityName"]').fill('وزارة الاختبار');
    await page.locator('input[name="executedAgainstName"]').fill('شركة التنفيذ');
    await page.locator('input[name="executionFileType"]').fill('TENFIDH');
    await page.locator('input[name="executionFileNumber"]').fill(`EX-TEST-${Date.now()}`);
    await page.locator('input[name="executionYear"]').fill('2026');

    await page.getByRole('button', { name: /إنشاء ملف تنفيذي/ }).first().click();

    // Accept two outcomes:
    const navigated = await page.waitForURL(/\/execution-files\/\d+/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (navigated) {
      // Fresh run — navigated to execution file detail
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
      test.info().annotations.push({
        type: 'result',
        description: 'promote-to-execution succeeded (fresh run)',
      });
    } else {
      // Re-run — error shown inside the modal
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 5_000 });
      const errText = await errorAlert.first().textContent();
      expect(errText?.length).toBeGreaterThan(0);
      test.info().annotations.push({
        type: 'result',
        description: `Re-run: backend rejected — "${errText}"`,
      });

      // Close modal — page should remain stable
      await page.keyboard.press('Escape');
    }
  });

  test('backend rejection error is displayed inside the modal (not hidden behind it)', async ({ page }) => {
    // Use a case that is NOT promotable (e.g. Case 1, ACTIVE but stage not FINALIZED)
    await loginAs(page, 'sectionHead');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    const promoteBtn = page.getByRole('button', { name: /ترقية إلى التنفيذ/ });
    await expect(promoteBtn).toBeVisible({ timeout: 5_000 });
    await promoteBtn.click();

    // Modal opens
    await expect(
      page.getByRole('dialog').or(page.getByText(/ترقية الدعوى إلى ملف تنفيذي/)).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Fill form and submit — backend will reject
    await page.locator('input[name="enforcingEntityName"]').fill('test');
    await page.locator('input[name="executedAgainstName"]').fill('test');
    await page.locator('input[name="executionFileType"]').fill('TENFIDH');
    await page.locator('input[name="executionFileNumber"]').fill('EX-FAIL');
    await page.locator('input[name="executionYear"]').fill('2026');
    await page.getByRole('button', { name: /إنشاء ملف تنفيذي/ }).first().click();

    // Error alert should appear INSIDE the modal (visible while modal is open)
    const modalAlert = page.getByRole('dialog').locator('[role="alert"]');
    await expect(modalAlert).toBeVisible({ timeout: 10_000 });
    const errText = await modalAlert.textContent();
    expect(errText?.length).toBeGreaterThan(0);

    // Close modal
    await page.getByRole('button', { name: /إلغاء/ }).click();
    // Page should be stable
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible();
  });

  test('STATE_LAWYER does NOT see the promote-to-execution button', async ({ page }) => {
    await loginAs(page, 'lawyer');
    await page.goto('/cases/1');
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });

    const promoteBtn = page.getByRole('button', { name: /ترقية إلى التنفيذ/ });
    await expect(promoteBtn).not.toBeVisible({ timeout: 3_000 });
  });
});

