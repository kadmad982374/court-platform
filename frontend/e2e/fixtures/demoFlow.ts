/**
 * Helpers used by the full-system demo video spec.
 *
 * Keeping them out of `00-full-system-demo.spec.ts` so the spec itself
 * reads top-to-bottom as a documented walk-through.
 */

import { type Page, expect } from '@playwright/test';
import { fieldByLabel } from './dom';

/** Read the numeric `caseId` from a `/cases/{id}` URL — throws if absent. */
export function caseIdFromUrl(page: Page): number {
  // BUG-006 fix: was (?:[/?#]$) which requires a trailing /?# char that
  // React Router never appends. Fixed to (?:[/?#]|$) — match trailing
  // separator OR end-of-string so plain /cases/42 is matched correctly.
  const m = page.url().match(/\/cases\/(\d+)/);
  if (!m) throw new Error(`Not on a /cases/{id} URL: ${page.url()}`);
  return Number(m[1]);
}

/** Read the numeric `executionFileId` from a `/execution-files/{id}` URL. */
export function executionFileIdFromUrl(page: Page): number {
  // BUG-006 fix: same regex issue as caseIdFromUrl above.
  const m = page.url().match(/\/execution-files\/(\d+)/);
  if (!m) throw new Error(`Not on a /execution-files/{id} URL: ${page.url()}`);
  return Number(m[1]);
}

/**
 * Defensively close any open modal/dialog overlay so subsequent clicks are
 * not intercepted. The Modal renders an overlay div with the structure
 *   <div role="presentation" class="fixed inset-0 z-50 ..."> ... </div>
 * and the close affordance is either a button labelled "إلغاء" or pressing
 * the Escape key. We try Escape first (cheapest), then a Cancel button.
 */
export async function dismissModalIfAny(page: Page): Promise<void> {
  const overlay = page.locator('div[role="presentation"].fixed.inset-0.z-50').first();
  if (!(await overlay.isVisible({ timeout: 250 }).catch(() => false))) return;
  // Try Escape twice (some focus traps swallow the first one).
  await page.keyboard.press('Escape').catch(() => undefined);
  if (!(await overlay.isVisible({ timeout: 250 }).catch(() => false))) return;
  await page.keyboard.press('Escape').catch(() => undefined);
  if (!(await overlay.isVisible({ timeout: 250 }).catch(() => false))) return;
  // Last resort: click the inline cancel button if it exists.
  const cancel = page.getByRole('button', { name: /^إلغاء$/ }).first();
  if (await cancel.isVisible({ timeout: 500 }).catch(() => false)) {
    await cancel.click().catch(() => undefined);
  }
}

/** Click the user-menu logout button rendered in the AppShell header. */
export async function logoutByHeaderButton(page: Page): Promise<void> {
  // Make sure no modal overlay is intercepting pointer events.
  await dismissModalIfAny(page);

  // Best-effort click on the actual sidebar/header logout control. The SPA's
  // AuthContext.logout() may rely on a route transition to trigger
  // RequireAuth's redirect, which doesn't always happen if we're sitting on
  // a deep URL — so we follow it up with a forced navigation below.
  const btn = page.getByRole('button', { name: 'تسجيل الخروج' }).first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await btn.click().catch(() => undefined);
    await page.waitForURL(/\/login/, { timeout: 3_000 }).catch(() => undefined);
  }

  // Belt-and-braces: wipe any leftover auth/state that AuthContext might
  // re-hydrate, so the next loginAs() starts from a perfectly clean slate,
  // then *force* the navigation to /login regardless of SPA behaviour.
  await page.evaluate(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });
  await page.goto('/login');
  await expect(page.locator('#username')).toBeVisible({ timeout: 10_000 });
}

/**
 * Fill the SECTION_HEAD create-case form with a unique demo payload.
 * Picks the first non-placeholder option in branch / department / court.
 * Returns the unique suffix used in the basis numbers (so the caller can
 * later recognise the case in the cases list).
 */
export async function fillCreateCaseForm(page: Page, opts: {
  publicEntity?: string;
  opponent?: string;
  firstHearingDate?: string;
} = {}): Promise<{ suffix: string }> {
  const branchSel = page.locator('select').nth(0);
  await expect(branchSel.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
  await branchSel.selectOption(
    (await branchSel.locator('option').nth(1).getAttribute('value'))!,
  );
  const deptSel = page.locator('select').nth(1);
  await expect(deptSel.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
  await deptSel.selectOption(
    (await deptSel.locator('option').nth(1).getAttribute('value'))!,
  );
  const courtSel = page.locator('select').nth(3);
  await expect(courtSel.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
  await courtSel.selectOption(
    (await courtSel.locator('option').nth(1).getAttribute('value'))!,
  );

  const suffix = Date.now().toString().slice(-6);
  await fieldByLabel(page, 'اسم الجهة العامة').fill(
    opts.publicEntity ?? 'وزارة العرض التوضيحي',
  );
  await fieldByLabel(page, 'اسم الخصم').fill(
    opts.opponent ?? 'شركة العرض التوضيحي',
  );
  await fieldByLabel(page, 'رقم الأساس الأصلي').fill(`DEMO-O-${suffix}`);
  await fieldByLabel(page, 'سنة الأساس الأصلي').fill('2026');
  await fieldByLabel(page, 'تاريخ القيد الأصلي').fill('2026-01-15');
  await fieldByLabel(page, 'رقم أساس المرحلة').fill(`DEMO-S-${suffix}`);
  await fieldByLabel(page, 'سنة المرحلة').fill('2026');
  await fieldByLabel(page, 'تاريخ الجلسة الأولى').fill(
    opts.firstHearingDate ?? '2026-06-01',
  );
  await fieldByLabel(page, 'سبب التأجيل الأول').fill('سبب اختبار العرض');
  return { suffix };
}

/**
 * Push a small in-memory file into the AttachmentsSection upload input.
 * The input is `<input type="file" hidden aria-label="اختر ملفًا للرفع">`.
 */
export async function uploadInMemoryAttachment(page: Page, opts: {
  filename: string;
  contentType?: string;
  bytes?: Buffer;
} = { filename: 'demo.txt' }): Promise<void> {
  const input = page.getByLabel('اختر ملفًا للرفع');
  await input.setInputFiles({
    name: opts.filename,
    mimeType: opts.contentType ?? 'text/plain',
    buffer: opts.bytes ?? Buffer.from(`demo upload — ${new Date().toISOString()}`),
  });
}

/** Check whether a given Arabic-named button is present and enabled. */
export async function buttonReady(page: Page, name: string | RegExp): Promise<boolean> {
  const btn = page.getByRole('button', { name }).first();
  if (await btn.count() === 0) return false;
  if (!(await btn.isVisible())) return false;
  return await btn.isEnabled();
}
