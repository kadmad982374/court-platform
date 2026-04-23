import { type Page, type Locator } from '@playwright/test';

/**
 * Robust helpers used across specs.
 *
 * Why they exist:
 *   - The app uses a custom `Field` component that renders
 *       <label>{label}</label> {children}
 *     WITHOUT a `htmlFor`/`id` association, so Playwright's
 *     `page.getByLabel(...)` returns nothing.  We therefore locate the
 *     control by walking from the visible Arabic label text to the
 *     adjacent form control.
 *   - The cases list renders an inline action button (`فتح`) instead of
 *     an <a href> on the row, so we click that button by row.
 */

/**
 * Returns the first form control (input/select/textarea) that follows a
 * <label> whose text exactly contains the given Arabic label.
 */
export function fieldByLabel(page: Page, labelText: string): Locator {
  // Match a <label> that contains the text, then take the first
  // input/select/textarea that follows it inside the same Field wrapper.
  return page
    .locator(`label:has-text("${labelText}")`)
    .first()
    .locator('xpath=following-sibling::*[self::input or self::select or self::textarea or .//input or .//select or .//textarea][1]')
    .locator('xpath=descendant-or-self::*[self::input or self::select or self::textarea][1]');
}

/** Open a case from the cases list by clicking the row that contains the given basis number. */
export async function openCaseFromList(page: Page, basisNumber: string | RegExp): Promise<void> {
  const row = page.locator('table tbody tr').filter({ hasText: basisNumber }).first();
  await row.getByRole('button', { name: /فتح/ }).click();
}

/** Open the FIRST case row (for tests where any case is acceptable). */
export async function openFirstCaseFromList(page: Page): Promise<void> {
  const firstOpenBtn = page
    .locator('table tbody tr')
    .first()
    .getByRole('button', { name: /^فتح$/ });
  await firstOpenBtn.click();
}

/** Open the FIRST stage of the currently-displayed case detail page. */
export async function openFirstStage(page: Page): Promise<void> {
  // The stages section title appears as text "المراحل"; wait for it then find the link.
  // The stages table has a Link wrapping a "فتح المرحلة" button.
  const stageLink = page.locator('a[href^="/stages/"]').first();
  await stageLink.waitFor({ state: 'visible', timeout: 15_000 });
  await stageLink.click();
}

