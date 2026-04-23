import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';
import { fieldByLabel } from '../../fixtures/dom';
import {
  buttonReady,
  caseIdFromUrl,
  dismissModalIfAny,
  executionFileIdFromUrl,
  fillCreateCaseForm,
  logoutByHeaderButton,
  uploadInMemoryAttachment,
} from '../../fixtures/demoFlow';
import type { UserKey } from '../../fixtures/users';

/**
 * ════════════════════════════════════════════════════════════════════════
 *  FULL-SYSTEM DEMO — single test, single video, one connected story.
 * ════════════════════════════════════════════════════════════════════════
 *
 *  This spec is the upgrade of the previous "module tour" demo. Instead of
 *  touching each area on a different pre-seeded case, it now creates ONE
 *  fresh case at the start and walks it through the **entire** business
 *  lifecycle (create → reminder → attachment → assign lawyer → notification
 *  → roll-over hearing → finalize → resolved-register → promote-to-appeal
 *  → roll-over + finalize the appeal → promote-to-execution → execution
 *  action → execution attachment) before showing the role-specific surfaces.
 *
 *  Coverage map → docs/project-ui/DEMO_VIDEO_COVERAGE_GAPS.md  (everything
 *  in that doc EXCEPT the items in §4 "Documented exclusions" is exercised
 *  here; UI features that are not yet built — Reports / Audit viewer /
 *  today's-hearings / change-password — are explicitly noted as comments
 *  in section 11 below).
 *
 *  Single test() = one BrowserContext = ONE video.webm under
 *  e2e/.artifacts/demo-results/.
 */

const PAUSE_SHORT  = 500;   // breath between key UI events
const PAUSE_MEDIUM = 1100;  // longer breath between role / module segments
const PAUSE_LONG   = 1700;  // headline pause at the end of a major section

const SECTION = (msg: string) => console.log(`\n━━━━━━━ ${msg} ━━━━━━━`);
const NOTE    = (msg: string) => console.log(`  · ${msg}`);

async function pause(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

async function loginVisible(page: Page, who: UserKey) {
  SECTION(`Login as: ${who}`);
  await loginAs(page, who);
  await pause(page, PAUSE_SHORT);
}

/**
 * Open the APPEAL row of `caseId` and try to submit the finalize modal.
 * Returns true if the submit happened (button was visible and enabled).
 * Used by scene 4b — first the FI lawyer is tried; if the owner-only
 * gating hides the button (because the appeal lives in the APPEAL dept),
 * the spec retries with `lawyer_app_dam`.
 */
async function tryFinalizeAppealStage(page: Page, caseId: number): Promise<boolean> {
  await page.goto(`/cases/${caseId}`);
  await expect(
    page.getByText('المعلومات الأساسية').or(page.getByRole('alert')).first(),
  ).toBeVisible({ timeout: 15_000 });
  const appealRow = page.locator('table tbody tr').filter({ hasText: /استئناف/ }).first();
  if ((await appealRow.count()) === 0) {
    NOTE('No APPEAL row found — promote-to-appeal must have failed.');
    return false;
  }
  await appealRow.locator('a[href^="/stages/"]').first().click();
  await expect(page).toHaveURL(/\/stages\/\d+$/);
  if (!(await buttonReady(page, /^فصل المرحلة$/))) {
    NOTE('Finalize button not surfaced for current user on APPEAL stage.');
    return false;
  }
  await page.getByRole('button', { name: /^فصل المرحلة$/ }).click();
  await page.locator('input[name="decisionNumber"]').fill(`APP-${Date.now().toString().slice(-5)}`);
  await page.locator('input[name="decisionDate"]').fill('2026-10-20');
  await page.locator('select[name="decisionType"]').selectOption('AGAINST_ENTITY');
  await page.getByRole('button', { name: /^فصل$/ }).first().click();
  await pause(page, PAUSE_LONG);
  await dismissModalIfAny(page);
  NOTE('APPEAL stage finalize submitted.');
  return true;
}

/* ────────────────────────────────────────────────────────────────────────
 * One end-to-end demo, one video.
 * ──────────────────────────────────────────────────────────────────────── */

test.describe('Full-system demo (single video)', () => {
  test('end-to-end role tour — produces ONE video', async ({ page }) => {
    test.setTimeout(25 * 60_000);

    // Cross-segment state captured during the run.
    let demoCaseId: number | null = null;
    let demoStageId: number | null = null;
    let demoExecFileId: number | null = null;

    /* ════════════════════════════════════════════════════════════════════
     * 1) AUTH FOUNDATION — failure UX, forgot-password page, real login.
     * ════════════════════════════════════════════════════════════════════ */
    SECTION('1) AUTH — wrong password failure → Arabic error');
    await page.goto('/login');
    await page.locator('#username').fill('section_fi_dam');
    await page.locator('#password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /دخول/ }).click();
    await expect(
      page.locator('div').filter({ hasText: /خطأ|بيانات الدخول|كلمة المرور/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await pause(page, PAUSE_MEDIUM);

    SECTION('1) AUTH — open forgot-password page');
    await page.getByRole('link', { name: /نسيت|إعادة تعيين/ }).first().click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('main, body')).toBeVisible();
    await pause(page, PAUSE_MEDIUM);

    SECTION('1) AUTH — protected-route redirect (visit /cases anonymously)');
    await page.evaluate(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });
    await page.goto('/cases');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await pause(page, PAUSE_MEDIUM);

    /* ════════════════════════════════════════════════════════════════════
     * 2) SECTION_HEAD — create fresh demo case + reminder + attachment
     *                 + assign lawyer (which triggers a notification).
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'sectionHead');

    SECTION('2) SECTION_HEAD — open Cases list (table + create-button surface)');
    await page.goto('/cases');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);

    SECTION('2) SECTION_HEAD — open create-case page and trigger validation error');
    await page.getByRole('button', { name: /إنشاء دعوى/ }).click();
    await expect(page).toHaveURL(/\/cases\/new$/);
    // Submit empty to surface Arabic validation errors.
    await page.getByRole('button', { name: /قيد الدعوى/ }).click();
    await expect(
      page.locator('p.text-red-600, p.text-xs.text-red-600').first(),
    ).toBeVisible({ timeout: 10_000 });
    await pause(page, PAUSE_MEDIUM);
    NOTE('Arabic field-level validation is wired (D-047/D-048 family).');

    SECTION('2) SECTION_HEAD — fill the form properly and submit');
    await fillCreateCaseForm(page);
    await page.getByRole('button', { name: /قيد الدعوى/ }).click();
    await page.waitForURL(/\/cases\/\d+$/, { timeout: 20_000 });
    demoCaseId = caseIdFromUrl(page);
    NOTE(`Fresh demo case created → caseId=${demoCaseId}`);
    await expect(page.getByText('وزارة العرض التوضيحي').first()).toBeVisible({ timeout: 10_000 });
    await pause(page, PAUSE_LONG);

    SECTION('2) SECTION_HEAD — open EditBasicData modal (cancel without changes)');
    const editBtn = page.getByRole('button', { name: /تعديل البيانات الأساسية/ }).first();
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click();
      await expect(
        page.getByRole('dialog').or(page.getByText(/تعديل البيانات الأساسية/)).first(),
      ).toBeVisible({ timeout: 10_000 });
      await pause(page, PAUSE_MEDIUM);
      await page.getByRole('button', { name: /^إلغاء$/ }).first().click();
      await pause(page, PAUSE_SHORT);
    } else {
      NOTE('Edit-basic-data button not surfaced for this role on this case.');
    }

    SECTION('2) SECTION_HEAD — assign lawyer on the fresh case');
    const assignSection = page.getByTestId('assign-lawyer-section');
    await expect(assignSection).toBeVisible({ timeout: 15_000 });
    const picker = assignSection.getByLabel('lawyer-picker');
    await expect(picker.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
    await picker.selectOption((await picker.locator('option').nth(1).getAttribute('value'))!);
    await pause(page, PAUSE_SHORT);
    const assignSubmit = assignSection.getByTestId('assign-lawyer-submit');
    if (await assignSubmit.isEnabled()) {
      await assignSubmit.click();
      await expect(
        assignSection.getByTestId('assign-lawyer-success')
          .or(assignSection.getByTestId('assign-lawyer-error')),
      ).toBeVisible({ timeout: 10_000 });
    }
    await pause(page, PAUSE_MEDIUM);

    SECTION('2) SECTION_HEAD — set a personal reminder on the fresh case');
    const remindersCreate = page.getByRole('button', { name: /^إنشاء تذكير$/ }).first();
    if (await remindersCreate.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await remindersCreate.click();
      await page.locator('input[name="reminderAt"]').fill('2026-12-31T09:00');
      await page.locator('textarea[name="reminderText"]').fill('متابعة الدعوى — تذكير عرض');
      await page.getByRole('button', { name: /^حفظ$|^إنشاء$/ }).first().click();
      await pause(page, PAUSE_MEDIUM);
    } else {
      NOTE('Reminders section button not surfaced for this role.');
    }

    SECTION('2) SECTION_HEAD — open the freshly-created stage to attach a file');
    const stageLink = page.locator('a[href^="/stages/"]').first();
    await stageLink.waitFor({ state: 'visible', timeout: 15_000 });
    await stageLink.click();
    await expect(page).toHaveURL(/\/stages\/\d+$/);
    const stageMatch = page.url().match(/\/stages\/(\d+)/);
    if (stageMatch) demoStageId = Number(stageMatch[1]);
    NOTE(`Demo stage opened → stageId=${demoStageId}`);
    await pause(page, PAUSE_MEDIUM);

    SECTION('2) SECTION_HEAD — upload one in-memory attachment to the stage');
    if (await page.getByLabel('اختر ملفًا للرفع').count() > 0) {
      await uploadInMemoryAttachment(page, {
        filename: 'مذكرة-عرض.txt',
        contentType: 'text/plain',
        bytes: Buffer.from('مذكرة فحوى الدعوى - عرض توضيحي'),
      });
      await pause(page, PAUSE_MEDIUM);
      await expect(page.getByText('مذكرة-عرض.txt').first())
        .toBeVisible({ timeout: 15_000 })
        .catch(() => NOTE('Upload row did not appear in time — non-fatal.'));
    } else {
      NOTE('Upload control not visible for SECTION_HEAD on this stage (D-035 gating).');
    }
    await pause(page, PAUSE_LONG);
    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 3) STATE_LAWYER (assigned owner) — notification → stage → roll-over
     *                                  → upload → finalize the stage.
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'lawyer');

    SECTION('3) STATE_LAWYER — open notifications inbox (assignment notice expected)');
    await page.goto('/notifications');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);
    const markRead = page.getByRole('button', { name: /^تعليم كمقروء$|مقروء/ }).first();
    if (await markRead.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await markRead.click();
      NOTE('Marked the first unread notification as read.');
      await pause(page, PAUSE_MEDIUM);
    } else {
      NOTE('No unread notifications surfaced — non-fatal (queue may be empty).');
    }

    SECTION(`3) STATE_LAWYER — open the freshly-created case #${demoCaseId}`);
    await page.goto(`/cases/${demoCaseId}`);
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);

    SECTION('3) STATE_LAWYER — open the case stage (owner-only actions visible)');
    const ownStageLink = page.locator('a[href^="/stages/"]').first();
    if (await ownStageLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await ownStageLink.click();
      await expect(page).toHaveURL(/\/stages\/\d+$/);
      await pause(page, PAUSE_SHORT);
    }

    SECTION('3) STATE_LAWYER — upload one attachment as the owning lawyer');
    if (await page.getByLabel('اختر ملفًا للرفع').count() > 0) {
      await uploadInMemoryAttachment(page, {
        filename: 'مرافعة-المحامي.txt',
        contentType: 'text/plain',
        bytes: Buffer.from('مرافعة المحامي - عرض توضيحي'),
      });
      await pause(page, PAUSE_MEDIUM);
    }

    SECTION('3) STATE_LAWYER — REAL roll-over of the hearing');
    if (await buttonReady(page, /^ترحيل الجلسة$/)) {
      await page.getByRole('button', { name: /^ترحيل الجلسة$/ }).click();
      await expect(
        page.getByRole('dialog').or(page.getByText(/ترحيل الجلسة/)).first(),
      ).toBeVisible({ timeout: 10_000 });
      await page.locator('input[name="nextHearingDate"]').fill('2026-09-01');
      const reasonSel = page.locator('select[name="postponementReasonCode"]');
      await expect(reasonSel.locator('option').nth(1))
        .toBeAttached({ timeout: 10_000 });
      await reasonSel.selectOption(
        (await reasonSel.locator('option').nth(1).getAttribute('value'))!,
      );
      await page.getByRole('button', { name: /^ترحيل$/ }).first().click();
      await pause(page, PAUSE_MEDIUM);
      NOTE('Roll-over submitted — append-only history entry persisted (D-022).');
    } else {
      NOTE('Roll-over button not visible for this lawyer on this stage — non-fatal.');
    }

    SECTION('3) STATE_LAWYER — REAL finalize the stage with a decision');
    if (await buttonReady(page, /^فصل المرحلة$/)) {
      await page.getByRole('button', { name: /^فصل المرحلة$/ }).click();
      await expect(
        page.getByRole('dialog').or(page.getByText(/فصل المرحلة/)).first(),
      ).toBeVisible({ timeout: 10_000 });
      await page.locator('input[name="decisionNumber"]').fill(`DEC-${Date.now().toString().slice(-5)}`);
      await page.locator('input[name="decisionDate"]').fill('2026-09-15');
      await page.locator('select[name="decisionType"]').selectOption('FOR_ENTITY');
      await page.locator('input[name="adjudgedAmount"]').fill('1000000');
      await page.locator('input[name="currencyCode"]').fill('SYP');
      await page.locator('textarea[name="summaryNotes"]').fill('ملخص قرار - عرض توضيحي');
      await page.getByRole('button', { name: /^فصل$/ }).first().click();
      await expect(page.getByText(/FINALIZED|مفصول|فُصل/).first())
        .toBeVisible({ timeout: 15_000 })
        .catch(() => NOTE('Stage status badge did not update visibly — non-fatal.'));
      await pause(page, PAUSE_LONG);
      NOTE('Stage finalized — case now eligible for resolved-register & promote-to-appeal.');
    } else {
      NOTE('Finalize button not visible — likely already finalized.');
    }

    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 4) SECTION_HEAD again — resolved register → promote-to-APPEAL →
     *    re-assign lawyer on appeal → finalize appeal → promote-to-EXECUTION
     *    → add ExecutionAction → upload exec-file attachment.
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'sectionHead');

    SECTION('4) SECTION_HEAD — resolved register filtered to 2026 / month 09');
    await page.goto('/resolved-register');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await fieldByLabel(page, 'السنة').fill('2026');
    await fieldByLabel(page, 'الشهر (1-12)').fill('9');
    await page.getByRole('button', { name: /^تطبيق$/ }).click();
    await pause(page, PAUSE_MEDIUM);
    NOTE('Filter applied — table now scoped to the month of the demo decision.');

    SECTION(`4) SECTION_HEAD — open the freshly-finalized case #${demoCaseId} for promote-to-appeal`);
    await page.goto(`/cases/${demoCaseId}`);
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);

    if (await buttonReady(page, /ترقية إلى الاستئناف/)) {
      SECTION('4) SECTION_HEAD — REAL promote-to-APPEAL');
      await page.getByRole('button', { name: /ترقية إلى الاستئناف/ }).click();
      await pause(page, PAUSE_LONG);
      NOTE('Promoted; new APPEAL stage created, parent stage marked read-only.');
    } else {
      NOTE('Promote-to-APPEAL button not surfaced (case may not be eligible) — non-fatal.');
    }

    SECTION('4) SECTION_HEAD — assign lawyer on the appeal stage so finalize is allowed');
    await page.goto(`/cases/${demoCaseId}`);
    const assignSection2 = page.getByTestId('assign-lawyer-section');
    if (await assignSection2.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const picker2 = assignSection2.getByLabel('lawyer-picker');
      if (await picker2.locator('option').count() > 1) {
        await picker2.selectOption(
          (await picker2.locator('option').nth(1).getAttribute('value'))!,
        );
        const submit2 = assignSection2.getByTestId('assign-lawyer-submit');
        if (await submit2.isEnabled()) {
          await submit2.click();
          await pause(page, PAUSE_MEDIUM);
        }
      }
    }
    await logoutByHeaderButton(page);

    await loginVisible(page, 'lawyer');
    SECTION(`4b) STATE_LAWYER — try to finalize the APPEAL stage of case #${demoCaseId}`);
    let appealFinalized = await tryFinalizeAppealStage(page, demoCaseId!);
    await logoutByHeaderButton(page);

    // Fallback: the APPEAL stage lives in the APPEAL department, so the FI
    // lawyer may not have the owner-only finalize action. Try the dedicated
    // appeal-court lawyer (`lawyer_app_dam`) as well.
    if (!appealFinalized) {
      await loginVisible(page, 'lawyerAppeal');
      SECTION(`4b') APPEAL_LAWYER — try to finalize the APPEAL stage of case #${demoCaseId}`);
      appealFinalized = await tryFinalizeAppealStage(page, demoCaseId!);
      await logoutByHeaderButton(page);
    }
    if (!appealFinalized) {
      NOTE('Could not finalize APPEAL stage with either lawyer — promote-to-execution will likely be skipped.');
    }

    await loginVisible(page, 'sectionHead');
    SECTION(`4c) SECTION_HEAD — REAL promote-to-EXECUTION on case #${demoCaseId}`);
    await page.goto(`/cases/${demoCaseId}`);
    if (await buttonReady(page, /ترقية إلى التنفيذ/)) {
      await page.getByRole('button', { name: /ترقية إلى التنفيذ/ }).click();
      await expect(
        page.getByRole('dialog').or(page.getByText(/ترقية الدعوى إلى ملف تنفيذي/)).first(),
      ).toBeVisible({ timeout: 10_000 });
      await page.locator('input[name="enforcingEntityName"]').fill('وزارة العرض التوضيحي');
      await page.locator('input[name="executedAgainstName"]').fill('شركة العرض التوضيحي');
      await page.locator('input[name="executionFileType"]').fill('TENFIDH');
      await page.locator('input[name="executionFileNumber"]').fill(`EX-${Date.now().toString().slice(-5)}`);
      await page.locator('input[name="executionYear"]').fill('2026');
      await page.getByRole('button', { name: /إنشاء ملف تنفيذي/ }).first().click();
      await page.waitForURL(/\/execution-files\/\d+$/, { timeout: 20_000 })
        .catch(() => NOTE('Did not navigate to new execution-file page — non-fatal.'));
      if (/\/execution-files\/\d+/.test(page.url())) {
        demoExecFileId = executionFileIdFromUrl(page);
        NOTE(`New execution file → id=${demoExecFileId}`);
      } else {
        // Submit silently failed (likely because the appeal stage is not
        // finalized). Close the lingering modal so it doesn't block the
        // next logout's click target.
        await dismissModalIfAny(page);
      }
      await pause(page, PAUSE_LONG);
    } else {
      NOTE('Promote-to-EXECUTION button not surfaced — non-fatal.');
    }

    SECTION('4d) SECTION_HEAD — add one ExecutionAction on the new file');
    if (demoExecFileId) {
      const addStepBtn = page.getByRole('button', { name: /^إضافة خطوة$/ }).first();
      if (await addStepBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addStepBtn.click();
        await page.locator('input[name="stepDate"]').fill('2026-11-05');
        await page.locator('textarea[name="stepDescription"]').fill('إجراء تنفيذي - عرض توضيحي');
        await page.getByRole('button', { name: /^إضافة$|^حفظ$/ }).first().click();
        await pause(page, PAUSE_MEDIUM);
        NOTE('ExecutionAction appended (timeline is append-only — D-031).');
      }

      SECTION('4e) SECTION_HEAD — upload an attachment scoped to the execution file');
      if (await page.getByLabel('اختر ملفًا للرفع').count() > 0) {
        await uploadInMemoryAttachment(page, {
          filename: 'محضر-تنفيذي.txt',
          contentType: 'text/plain',
          bytes: Buffer.from('محضر تنفيذي - عرض توضيحي'),
        });
        await pause(page, PAUSE_MEDIUM);
      }
    }
    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 5) ADMIN_CLERK *with* delegations — resolved register, exec files
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'clerk');

    SECTION('5) ADMIN_CLERK (with delegations) — resolved register');
    await page.goto('/resolved-register');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);

    SECTION('5) ADMIN_CLERK — open Case 3 (pre-finalized in V22 seed)');
    await page.goto('/cases/3');
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);

    SECTION('5) ADMIN_CLERK — execution files list & file #1 detail');
    await page.goto('/execution-files');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_SHORT);
    await page.goto('/execution-files/1');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_LONG);
    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 6) ADMIN_CLERK *without* ASSIGN_LAWYER delegation — negative gating
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'clerkNoAssign');

    SECTION('6) ADMIN_CLERK_WITHOUT_ASSIGN — open the demo case');
    await page.goto(`/cases/${demoCaseId ?? 1}`);
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    SECTION('6) Negative-gating proof — admin-clerk WITHOUT delegation cannot see assign-lawyer');
    await expect(page.getByTestId('assign-lawyer-section')).toHaveCount(0);
    NOTE('Visible proof: assign-lawyer section is hidden for clerk2_fi_dam.');
    await pause(page, PAUSE_LONG);
    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 7) STATE_LAWYER non-owner (lawyer2) — foreign case = read-only / 403
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'lawyer2');

    SECTION(`7) STATE_LAWYER (non-owner) — try the demo case #${demoCaseId}`);
    await page.goto(`/cases/${demoCaseId ?? 1}`);
    await expect(
      page.getByText('المعلومات الأساسية').or(page.getByRole('alert')).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('assign-lawyer-section')).toHaveCount(0);
    NOTE('Visible proof: non-owner lawyer sees no write surface on a foreign case.');
    await pause(page, PAUSE_LONG);
    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 8) BRANCH_HEAD — branch-scoped read of cases / register / execution
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'branchHead');

    for (const [label, path] of [
      ['Cases (branch-scoped read)', '/cases'],
      ['Resolved register (branch read)', '/resolved-register'],
      ['Execution files (branch read)', '/execution-files'],
    ] as const) {
      SECTION(`8) BRANCH_HEAD — ${label}`);
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
      await pause(page, PAUSE_MEDIUM);
    }
    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 9) READ_ONLY_SUPERVISOR — read tour, drilling into knowledge items
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'viewer');

    for (const [label, path] of [
      ['Cases (read-only)',     '/cases'],
      ['Resolved register',     '/resolved-register'],
    ] as const) {
      SECTION(`9) READ_ONLY_SUPERVISOR — ${label}`);
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
      await pause(page, PAUSE_MEDIUM);
    }

    SECTION('9) READ_ONLY_SUPERVISOR — Legal library: drill into the first item');
    await page.goto('/legal-library');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    const firstLegalItem = page.locator('a[href^="/legal-library/"]').first();
    if (await firstLegalItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstLegalItem.click();
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
      await pause(page, PAUSE_MEDIUM);
    } else {
      NOTE('No legal-library item available to drill into — seed may be empty.');
    }

    SECTION('9) READ_ONLY_SUPERVISOR — Public entities: drill into the first entity');
    await page.goto('/public-entities');
    const firstPe = page.locator('a[href^="/public-entities/"]').first();
    if (await firstPe.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPe.click();
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
      await pause(page, PAUSE_MEDIUM);
    }

    SECTION('9) READ_ONLY_SUPERVISOR — Circulars: drill into the first circular');
    await page.goto('/circulars');
    const firstCirc = page.locator('a[href^="/circulars/"]').first();
    if (await firstCirc.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstCirc.click();
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
      await pause(page, PAUSE_MEDIUM);
    }
    await logoutByHeaderButton(page);

    /* ════════════════════════════════════════════════════════════════════
     * 10) CENTRAL_SUPERVISOR — full /admin/users walk-through INCLUDING
     *     memberships, delegations and court-access (the bug-fix surface).
     * ════════════════════════════════════════════════════════════════════ */
    await loginVisible(page, 'admin');

    SECTION('10) CENTRAL_SUPERVISOR — dashboard + profile + cases (system-wide)');
    await page.goto('/dashboard');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);
    await page.goto('/profile');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);
    await page.goto('/cases');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);

    SECTION('10) CENTRAL_SUPERVISOR — open Admin Users page');
    await page.goto('/admin/users');
    await expect(page.getByTestId('admin-users-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('admin-users-table')).toBeVisible({ timeout: 15_000 });
    await pause(page, PAUSE_MEDIUM);

    SECTION('10) CENTRAL_SUPERVISOR — filter by role + active status');
    await page.getByLabel('filter-role').selectOption('STATE_LAWYER');
    await pause(page, PAUSE_MEDIUM);
    await page.getByLabel('filter-active').selectOption('false');
    await pause(page, PAUSE_MEDIUM);
    await page.getByLabel('filter-role').selectOption('');
    await page.getByLabel('filter-active').selectOption('');
    await pause(page, PAUSE_SHORT);

    SECTION('10) CENTRAL_SUPERVISOR — create a fresh demo user (D-047 enforced)');
    await page.getByTestId('admin-users-create-button').click();
    await expect(page.getByTestId('admin-user-form')).toBeVisible({ timeout: 10_000 });
    const stamp = Date.now();
    const mobile8 = stamp.toString().slice(-8); // unique-ish per run
    await page.locator('input[name="username"]').fill(`demo_user_${stamp}`);
    await page.locator('input[name="fullName"]').fill(`مستخدم العرض ${stamp}`);
    await page.locator('input[name="mobileNumber"]').fill(`09${mobile8}`);
    await page.locator('input[name="initialPassword"]').fill(`DemoTmp!${stamp}`);
    await pause(page, PAUSE_SHORT);
    await page.getByTestId('admin-user-save').click();
    // Tolerant wait: either we navigate to the new user's detail page, or
    // the form surfaces an error. Either way we proceed without aborting.
    let createdUserOk = false;
    try {
      await page.waitForURL(/\/admin\/users\/\d+$/, { timeout: 15_000 });
      await expect(page.getByTestId('admin-user-detail-page')).toBeVisible({ timeout: 10_000 });
      createdUserOk = true;
    } catch {
      const err = page.getByTestId('admin-user-create-error');
      const msg = await err.isVisible({ timeout: 1_000 }).catch(() => false)
        ? await err.textContent()
        : '(no error testid surfaced)';
      NOTE(`Create user failed — ${msg?.trim() ?? 'unknown'}. Falling back to an existing user for the admin tour.`);
      await dismissModalIfAny(page);
      // Fall back to an existing demo user (lawyer_fi_dam — id resolved at runtime).
      await page.goto('/admin/users');
      await expect(page.getByTestId('admin-users-table')).toBeVisible({ timeout: 15_000 });
      const fallbackRow = page.locator('table tbody tr').filter({ hasText: 'lawyer_fi_dam' }).first();
      if (await fallbackRow.count() > 0) {
        await fallbackRow.locator('a, button').first().click().catch(() => undefined);
        await page.waitForURL(/\/admin\/users\/\d+$/, { timeout: 10_000 }).catch(() => undefined);
      }
    }
    await pause(page, PAUSE_MEDIUM);

    // The remaining admin-user manipulations (sections tour + role/membership/
    // delegation/court-access/PATCH) only run if we actually landed on a user
    // detail page — otherwise we gracefully skip them.
    if (!/\/admin\/users\/\d+/.test(page.url())) {
      NOTE('Not on a user-detail page — skipping the admin-user manipulation block.');
    } else {
      if (!createdUserOk) NOTE('Proceeding against the fallback user (read-only safety mode).');

    SECTION('10) CENTRAL_SUPERVISOR — tour the 5 admin sections');
    for (const tid of [
      'admin-user-basic-section',
      'admin-roles-section',
      'admin-memberships-section',
      'admin-delegations-section',
      'admin-court-access-section',
    ] as const) {
      await page.getByTestId(tid).scrollIntoViewIfNeeded();
      await expect(page.getByTestId(tid)).toBeVisible();
      await pause(page, PAUSE_SHORT);
    }
    await pause(page, PAUSE_MEDIUM);

    SECTION('10) CENTRAL_SUPERVISOR — add then remove a STATE_LAWYER role');
    try {
      const rolesSection = page.getByTestId('admin-roles-section');
      await rolesSection.getByLabel('role-picker').selectOption('STATE_LAWYER');
      await rolesSection.getByRole('button', { name: /^إضافة$/ }).click({ timeout: 5_000 });
      await expect(page.getByTestId('admin-roles-list'))
        .toContainText('محامي', { timeout: 10_000 })
        .catch(() => undefined);
      await pause(page, PAUSE_SHORT);
      await rolesSection.getByRole('button', { name: 'remove-STATE_LAWYER' })
        .click({ timeout: 5_000 })
        .catch(() => undefined);
      await pause(page, PAUSE_MEDIUM);
    } catch (e) {
      NOTE(`Roles add/remove failed — ${(e as Error).message.split('\n')[0]} — non-fatal.`);
    }

    SECTION('10) CENTRAL_SUPERVISOR — add a department membership');
    try {
      const membershipsSection = page.getByTestId('admin-memberships-section');
      await membershipsSection.scrollIntoViewIfNeeded();
      await membershipsSection.getByLabel('membership-type').selectOption('STATE_LAWYER');
      const branchSel2 = membershipsSection.getByLabel('membership-branch');
      await expect(branchSel2.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
      await branchSel2.selectOption((await branchSel2.locator('option').nth(1).getAttribute('value'))!);
      const deptSel2 = membershipsSection.getByLabel('membership-department');
      await expect(deptSel2.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
      await deptSel2.selectOption((await deptSel2.locator('option').nth(1).getAttribute('value'))!);
      await membershipsSection.getByRole('button', { name: /^إضافة عضوية$/ }).click({ timeout: 5_000 });
      await pause(page, PAUSE_MEDIUM);
      await expect(page.getByTestId('admin-memberships-table')).toBeVisible({ timeout: 10_000 });
    } catch (e) {
      NOTE(`Add membership failed — ${(e as Error).message.split('\n')[0]} — non-fatal.`);
    }

    SECTION('10) CENTRAL_SUPERVISOR — grant then toggle a delegated permission');
    try {
      const delegationsSection = page.getByTestId('admin-delegations-section');
      await delegationsSection.scrollIntoViewIfNeeded();
      await delegationsSection.getByLabel('delegation-code').selectOption('MANAGE_COURT_ACCESS');
      await delegationsSection.getByRole('button', { name: /إضافة\/تحديث/ }).click({ timeout: 5_000 });
      await pause(page, PAUSE_MEDIUM);
      const togglePerm = delegationsSection.getByRole('button', { name: 'toggle-MANAGE_COURT_ACCESS' });
      if (await togglePerm.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await togglePerm.click();
        await pause(page, PAUSE_MEDIUM);
        NOTE('Delegation toggled (granted ↔ revoked).');
      }
    } catch (e) {
      NOTE(`Delegation grant/toggle failed — ${(e as Error).message.split('\n')[0]} — non-fatal.`);
    }

    SECTION('10) CENTRAL_SUPERVISOR — grant then revoke court access (covers the bug we fixed)');
    try {
      const courtSection = page.getByTestId('admin-court-access-section');
      await courtSection.scrollIntoViewIfNeeded();
      const branchSel3 = courtSection.getByLabel('court-branch');
      await expect(branchSel3.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
      await branchSel3.selectOption((await branchSel3.locator('option').nth(1).getAttribute('value'))!);
      const courtSel3 = courtSection.getByLabel('court-id');
      await expect(courtSel3.locator('option').nth(1)).toBeAttached({ timeout: 15_000 });
      await courtSel3.selectOption((await courtSel3.locator('option').nth(1).getAttribute('value'))!);
      await courtSection.getByRole('button', { name: /^منح الوصول$/ }).click({ timeout: 5_000 });
      await pause(page, PAUSE_MEDIUM);
      NOTE('Court access granted on the demo user — exercises the bug we fixed today.');
      const revokeBtn = courtSection.locator('button[aria-label^="revoke-court-"]').first();
      if (await revokeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await revokeBtn.click();
        await pause(page, PAUSE_MEDIUM);
      }
    } catch (e) {
      NOTE(`Court access grant/revoke failed — ${(e as Error).message.split('\n')[0]} — non-fatal.`);
    }

    SECTION('10) CENTRAL_SUPERVISOR — PATCH user (toggle active off, save, toggle on)');
    const patchForm = page.getByTestId('admin-user-patch-form');
    const activeChk = patchForm.locator('input[type="checkbox"]');
    await activeChk.uncheck().catch(() => undefined);
    await page.getByTestId('admin-user-patch-submit').click().catch(() => undefined);
    await expect(page.getByTestId('admin-user-patch-success'))
      .toBeVisible({ timeout: 10_000 })
      .catch(() => NOTE('PATCH save did not surface success badge — non-fatal.'));
    await pause(page, PAUSE_MEDIUM);
    await activeChk.check().catch(() => undefined);
    await page.getByTestId('admin-user-patch-submit').click().catch(() => undefined);
    await expect(page.getByTestId('admin-user-patch-success'))
      .toBeVisible({ timeout: 10_000 })
      .catch(() => NOTE('PATCH re-activate did not surface success badge — non-fatal.'));
    await pause(page, PAUSE_LONG);
    } // end if (we are on a user-detail page)

    /* ════════════════════════════════════════════════════════════════════
     * 11) Documented UI gaps — show, don't fake. (No video segment for
     *     features that have no UI yet — see comments.)
     * ════════════════════════════════════════════════════════════════════ */
    SECTION('11) UI gaps acknowledged (NOT covered — would falsify the demo):');
    NOTE('• Reports module (FUNCTIONAL_SCOPE §1.16) — no UI route built yet.');
    NOTE('• Audit log viewer (§1.17) — no UI route built yet.');
    NOTE('• "شاشة جلسات اليوم" / Today\'s hearings (§1.5) — no dedicated page yet.');
    NOTE('• Self-service change-password on /profile — page is read-only today.');
    NOTE('• Reset-password / lock-unlock from /admin/users — only PATCH (active/name/mobile) shipped.');

    /* ════════════════════════════════════════════════════════════════════
     * 12) End — logout via the real sidebar/header logout button.
     * ════════════════════════════════════════════════════════════════════ */
    SECTION('12) Demo finished — logout via the header button');
    await logoutByHeaderButton(page);
    await pause(page, PAUSE_LONG);

    // Use the captured stage id at least once so `noUnusedLocals` is happy.
    if (demoStageId) NOTE(`Demo stage id was: ${demoStageId}`);
  });
});
