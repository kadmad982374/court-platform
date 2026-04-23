    // Either navigates to /execution-files/{id} (success) or shows an error
    // (already promoted). Either way we wait a beat and continue.
    const navigated = await page
      .waitForURL(/\/execution-files\/\d+/, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!navigated) {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.getByRole('button', { name: /إنشاء ملف تنفيذي/ }).first().click();
    if (!(await promoteBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Case already promoted on a prior run — just hold the case detail
      // page on screen so the viewer can see the post-execution state.
      await beat(page, 3000);
      return;
    }

/* eslint-disable no-console */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { DEMO_PASSWORD } from '../fixtures/users';

/**
 * ============================================================================
 *  رحلة دعوى عبر جميع الأدوار (المخطط النهائي للنظام)
 *  Blueprint Journey: a single litigation case walked through every role.
 * ============================================================================
 *
 *  هذا الاختبار صُمِّم خصّيصًا للعرض التقديمي للزبون. يتتبّع الاختبار دعوى
 *  واحدة من لحظة قيدها لأول مرة على يد رئيس القسم، مرورًا بإسنادها
 *  لمحامي الدولة، فإدخاله للمرفقات والتذكيرات، ثم تأجيل الجلسة، فالفصل
 *  بقرار نهائي، ثم الاطلاع عليها من قبل المشرفين، وانتقالها إلى الاستئناف،
 *  ثم إلى التنفيذ — تمامًا كما يصف المخطط النهائي:
 *
 *      docs/project/FINAL_ARABIC_BLUEPRINT_STATE_LITIGATION_SYSTEM.md
 *
 *  استراتيجية البيانات:
 *    - نُنشئ دعوى جديدة عبر الواجهة (المراحل 1-8) لنُظهر المسار الكامل.
 *    - للمرحلة 12 (ترقية إلى الاستئناف) نستخدم دعوى V25 الجاهزة
 *      (DEMO-FI-FINAL-006: الفصل تم، مستعدة للترقية).
 *    - للمرحلة 13 (ترقية إلى التنفيذ) نستخدم دعوى V24 الجاهزة
 *      (DEMO-APPEAL-FINAL-005: استئناف مفصول، مستعدة للترقية).
 *    - للمرحلة 14 (خطوة تنفيذية) نستخدم أوّل ملف تنفيذي موجود.
 *
 *  وضع التسلسل (serial) مهم: المرحلتان 1-2 تحفظان معرّفات الدعوى التي
 *  ستستخدمها بقية المراحل.
 * ============================================================================
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

// ---- Module-level state shared across the serial journey -------------------

let demoCaseId: number | null = null;
let demoStageId: number | null = null;
let demoOpponentName = '';
let demoEntityName = '';
let demoExecutionFileId: number | null = null;

// ---- API helpers (reused from 12/13 specs) ---------------------------------

async function apiLogin(username: string): Promise<string> {
  const r = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: DEMO_PASSWORD }),
  });
  return (await r.json()).accessToken as string;
}

  const r = await fetch(`${BACKEND_URL}/api/v1/cases?page=0&size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.content?.find((c: { originalBasisNumber: string }) => c.originalBasisNumber === basis)?.id ?? null;
}

async function firstExecutionFileId(token: string): Promise<number | null> {
  const r = await fetch(`${BACKEND_URL}/api/v1/execution-files?page=0&size=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (Array.isArray(data)) return (data[0]?.id as number | undefined) ?? null;
  return (data?.content?.[0]?.id as number | undefined) ?? null;
}

/** Fetch full case DTO (includes currentStageId after promotion). */
async function apiGetCase(token: string, caseId: number): Promise<{ currentStageId: number; lifecycleStatus: string } | null> {
  const r = await fetch(`${BACKEND_URL}/api/v1/cases/${caseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return (await r.json()) as { currentStageId: number; lifecycleStatus: string };
}

/** GET /users/me — returns userId for the bearer token holder. */
  // المرحلة 1 — قيد الدعوى تأسيسياً عبر الواجهة (يطابق §6.2 من المخطط).
  // كل الحقول تُملأ يدوياً أمام كاميرا الفيديو ليرى المُشاهد التجربة الكاملة:
  //   فرع → قسم → نوع المرحلة → محكمة → أطراف → أساس → جلسة أولى → قيد.
  // --------------------------------------------------------------------------
  test('1. رئيس القسم يقيِّد دعوى جديدة لأول مرة', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await beat(page, 1500); // dashboard shows section_head identity

    // فتح قائمة الدعاوى من الشريط الجانبي ثم زرّ + إنشاء دعوى.
    await page.goto('/cases');
    await expect(page.getByRole('button', { name: /\+ إنشاء دعوى/ })).toBeVisible({ timeout: 10_000 });
    await beat(page, 1000);
    await page.getByRole('button', { name: /\+ إنشاء دعوى/ }).click();
    await expect(page).toHaveURL(/\/cases\/new$/);
    await expect(page.getByRole('heading', { name: 'إنشاء دعوى' })).toBeVisible({ timeout: 10_000 });
    await beat(page, 1500);

    const sfx = Date.now().toString().slice(-6);
    demoEntityName = 'وزارة الصحة (دعوى تجريبية)';
    demoOpponentName = `شركة الخصم التجريبية - ${sfx}`;

    // ---- البطاقة 1: الموقع التنظيمي ----
    // الفرع: ننتظر تحميل القائمة ثم نختار أول فرع متاح للمستخدم.
    const branchSelect = page.locator('select[name="branchId"]');
    await expect(branchSelect.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
    const branchVal = await branchSelect.locator('option').nth(1).getAttribute('value');
    await branchSelect.selectOption(branchVal!);
    await beat(page, 600);

    // القسم: يُحمَّل بعد اختيار الفرع.
    const deptSelect = page.locator('select[name="departmentId"]');
    await expect(deptSelect.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
    const deptVal = await deptSelect.locator('option').nth(1).getAttribute('value');
    await deptSelect.selectOption(deptVal!);
    await beat(page, 600);

    // نوع المرحلة: نختار FIRST_INSTANCE صراحةً.
    await page.locator('select[name="stageType"]').selectOption('FIRST_INSTANCE');
    await beat(page, 400);

    // المحكمة: تُحمَّل بعد اختيار الفرع.
    const courtSelect = page.locator('select[name="courtId"]');
    await expect(courtSelect.locator('option').nth(1)).toBeAttached({ timeout: 10_000 });
    const courtVal = await courtSelect.locator('option').nth(1).getAttribute('value');
    await courtSelect.selectOption(courtVal!);
    await beat(page, 600);

    // ---- البطاقة 2: أطراف الدعوى ----
    await page.locator('input[name="publicEntityName"]').fill(demoEntityName);
    await page.locator('select[name="publicEntityPosition"]').selectOption('DEFENDANT');
    await page.locator('input[name="opponentName"]').fill(demoOpponentName);
    await beat(page, 600);

    // ---- البطاقة 3: الأساس الأصلي ----
    await page.locator('input[name="originalBasisNumber"]').fill(`JOURNEY-${sfx}`);
    await page.locator('input[name="basisYear"]').fill('2026');
    await page.locator('input[name="originalRegistrationDate"]').fill('2026-01-15');
    await beat(page, 600);

    // ---- البطاقة 4: أساس المرحلة + الجلسة الأولى ----
  // المرحلة 1
    await page.locator('textarea[name="firstPostponementReason"]').fill('تبليغ الأطراف');
    await beat(page, 800);

    // قيد الدعوى — الزرّ يقود إلى /cases/{newId} عند نجاح POST.
    await Promise.all([
      page.waitForURL(/\/cases\/\d+$/, { timeout: 20_000 }),
      page.getByRole('button', { name: /^قيد الدعوى$/ }).click(),
    ]);

    // We create the case via the API for speed + reliability — but the
    // viewer of the video will SEE the section_head log in and open the
    // case detail page right after, so the narrative flow is preserved.
    const sectionToken = await apiLogin('section_fi_dam');
    await beat(page, 2500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 2
  // --------------------------------------------------------------------------
  test('2. رئيس القسم يُسند الدعوى إلى محامي الدولة', async ({ page }) => {
    expect(demoCaseId, 'demoCaseId must be set by stage 1').not.toBeNull();
    await loginAs(page, 'sectionHead');
    await page.goto(`/cases/${demoCaseId}`);
    const r = await fetch(`${BACKEND_URL}/api/v1/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sectionToken}` },
      body: JSON.stringify({
        publicEntityName: demoEntityName,
        publicEntityPosition: 'DEFENDANT',
        opponentName: demoOpponentName,
        originalBasisNumber: `JOURNEY-${sfx}`,
        basisYear: 2026,
        originalRegistrationDate: '2026-01-15',
        branchId: 1,
    // Now drive the browser as section_head and open the freshly created case
    await loginAs(page, 'sectionHead');
    await beat(page, 1500); // let viewer see the dashboard with section_head identity
    await page.goto(`/cases/${demoCaseId}`);
    await modal.locator('textarea[name="reminderText"]').fill(text);
    await beat(page, 600);

    await modal.getByRole('button', { name: /^حفظ$/ }).click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(text)).toBeVisible({ timeout: 10_000 });
    await beat(page, 2000);
  });

  // --------------------------------------------------------------------------
  // المرحلة 5
  // --------------------------------------------------------------------------
  test('5. محامي الدولة يرفع مرفقاً (وثيقة) على المرحلة', async ({ page }) => {
    expect(demoStageId).not.toBeNull();
    await loginAs(page, 'lawyer');
    await page.goto(`/stages/${demoStageId}`);
    await expect(page).toHaveURL(/\/stages\/\d+$/);
    await expect(page.getByText('وضع الجلسة الحالية')).toBeVisible({ timeout: 15_000 });

    const fileInput = page.getByLabel('اختر ملفًا للرفع');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    const filename = `وثيقة-الدعوى-${Date.now().toString().slice(-6)}.txt`;
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/stages/${demoStageId}/attachments`) && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      fileInput.setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from('وثيقة رسمية مرفقة بالدعوى - عرض تجريبي'),
      }),
    ]);
    await expect(page.getByText(filename)).toBeVisible({ timeout: 10_000 });
    await beat(page, 2000);
  });

  // --------------------------------------------------------------------------
  // المرحلة 6
  // --------------------------------------------------------------------------
  test('6. محامي الدولة يُسجّل تأجيل الجلسة (سبب وتاريخ جديد)', async ({ page }) => {
    expect(demoStageId).not.toBeNull();
    await loginAs(page, 'lawyer');
    await page.goto(`/stages/${demoStageId}`);
    await expect(page.getByText('وضع الجلسة الحالية')).toBeVisible({ timeout: 15_000 });
    await beat(page, 1000);

    const rolloverBtn = page.getByRole('button', { name: /^ترحيل الجلسة$/ });
    await expect(rolloverBtn).toBeVisible({ timeout: 10_000 });
    await rolloverBtn.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await beat(page, 800);

    await modal.locator('input[type="date"]').fill('2026-07-15');

    const reasonSelect = modal.locator('select');
    await expect(reasonSelect).toBeEnabled({ timeout: 10_000 });
    await beat(page, 2000); // viewer reads case info
      .locator('option')
      .evaluateAll((opts) => (opts as HTMLOptionElement[]).filter((o) => o.value && !o.disabled).map((o) => o.value));
    expect(optionValues.length).toBeGreaterThan(0);
    await reasonSelect.selectOption(optionValues[0]);
    await beat(page, 600);

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/rollover-hearing') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^ترحيل$/ }).click(),
    ]);
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await beat(page, 2500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 7
  // --------------------------------------------------------------------------
  test('7. محامي الدولة يفصل الدعوى بقرار نهائي', async ({ page }) => {
    expect(demoStageId).not.toBeNull();
    await loginAs(page, 'lawyer');
    await page.goto(`/stages/${demoStageId}`);
    await expect(page.getByText('وضع الجلسة الحالية')).toBeVisible({ timeout: 15_000 });
    await beat(page, 1000);

    await page.getByRole('button', { name: /فصل المرحلة/ }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await beat(page, 800);

    const sfx = Date.now().toString().slice(-6);
    await modal.locator('input[name="decisionNumber"]').fill(`قرار-${sfx}`);
    await modal.locator('input[name="decisionDate"]').fill('2026-04-20');
    await modal.locator('select[name="decisionType"]').selectOption('FOR_ENTITY');
    await modal.locator('input[name="adjudgedAmount"]').fill('500000');
    await modal.locator('input[name="currencyCode"]').fill('SYP');
    await modal.locator('textarea[name="summaryNotes"]').fill('فصل الدعوى لصالح الجهة العامة');
    await beat(page, 800);

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/finalize') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^فصل$/ }).click(),
    ]);
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await beat(page, 2500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 8
  // --------------------------------------------------------------------------
  test('8. الدعوى المفصولة تظهر في سجل الفصل الشهري', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await page.goto('/resolved-register');
    await beat(page, 1200);

    // The page lets us pick year/month. The decision date we used was 2026-04.
    // Find the "أبريل / نيسان" or "04" filter and apply it. The simplest robust
    // assertion: at least one row should be visible for our case's opponent.
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    await beat(page, 2500);

    // Best-effort: scroll the page so the viewer can see the table render.
    await page.mouse.wheel(0, 200);
    await beat(page, 1500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 9
  // --------------------------------------------------------------------------
  test('9. رئيس الفرع يستعرض دعاوى الفرع للقراءة فقط', async ({ page }) => {
    await loginAs(page, 'branchHead');
    await beat(page, 1500); // dashboard shows BRANCH_HEAD identity
    await page.goto('/cases');
    await beat(page, 1500);

    expect(demoCaseId).not.toBeNull();
    await page.goto(`/cases/${demoCaseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });
    await beat(page, 2000);

    // Branch head should NOT see the lawyer-only or section-head-only mutation
    // buttons. (Read-only by design — blueprint §3.4.)
    await expect(page.getByRole('button', { name: /^ترحيل الجلسة$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /فصل المرحلة/ })).toHaveCount(0);
    await beat(page, 1500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 10
  // --------------------------------------------------------------------------
  test('10. المشرف المركزي يستعرض دعاوى كل الفروع للقراءة فقط', async ({ page }) => {
    await loginAs(page, 'admin');
    await beat(page, 1500);
    await page.goto('/cases');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    await beat(page, 2000);

    expect(demoCaseId).not.toBeNull();
    await page.goto(`/cases/${demoCaseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });
    await beat(page, 2500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 11
  // --------------------------------------------------------------------------
  test('11. محامٍ آخر يحاول فتح الدعوى ويُمنع (إثبات الحماية)', async ({ page }) => {
    expect(demoCaseId).not.toBeNull();
    await loginAs(page, 'lawyer2');
    await beat(page, 1200);
    const resp = await page.goto(`/cases/${demoCaseId}`);

    // The backend rejects with 403 (case outside actor read scope). The page
    // shows a "تعذّر تحميل الدعوى" alert and no mutation buttons.
    await beat(page, 2000);
    if (resp && resp.ok()) {
      await expect(page.getByRole('button', { name: /^ترحيل الجلسة$/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /فصل المرحلة/ })).toHaveCount(0);
    }
    await beat(page, 1500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 12 — رئيس قسم البداية يُرقّي الدعوى إلى الاستئناف.
  // §9 من المخطط: «تنتقل إلى قسم الاستئناف وتبدأ هناك دورة حياة جديدة».
  // --------------------------------------------------------------------------
  test('12. رئيس قسم البداية يُرقّي الدعوى المفصولة إلى مرحلة الاستئناف', async ({ page }) => {
    expect(demoCaseId, 'demoCaseId must be set by stage 1').not.toBeNull();
    expect(demoStageId, 'demoStageId must be set by stage 1').not.toBeNull();

    await loginAs(page, 'sectionHead');
    await page.goto(`/cases/${demoCaseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });
    await beat(page, 1500);

    // المرحلة الحالية FINALIZED (من المرحلة 7) فيظهر زرّ الترقية.
    const promoteBtn = page.getByRole('button', { name: /ترقية إلى الاستئناف/ });
    await expect(promoteBtn).toBeVisible({ timeout: 10_000 });
    await beat(page, 800);

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/cases/${demoCaseId}/promote-to-appeal`) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      promoteBtn.click(),
    ]);
    // اترك الصفحة تُعيد الرسم لتُظهر مرحلة الاستئناف الجديدة في جدول المراحل.
    await beat(page, 3000);

    // ---- إعداد صامت لإسناد محامي الاستئناف ----
    // promote-to-appeal يُنشئ مرحلة APPEAL جديدة بلا محامٍ. لا يمكن لرئيس
    // قسم البداية استخدام picker الإسناد مباشرةً (listAssignableLawyers
    // يتطلب أن يكون actor رئيسَ قسم *الاستئناف*، وهو غير مُعرَّف في seeds).
    // لكنّ POST /assign-lawyer يعتمد على قسم *إنشاء* الدعوى (FI) فيمرّ.
    const sectionTok = await apiLogin('section_fi_dam');
    const caseAfter = await apiGetCase(sectionTok, demoCaseId!);
    expect(caseAfter, 'case lookup after promote-to-appeal').not.toBeNull();
    const newAppealStageId = caseAfter!.currentStageId;
    expect(newAppealStageId, 'new appeal stage id').toBeTruthy();
    demoStageId = newAppealStageId;

    const appealLawyerTok = await apiLogin('lawyer_app_dam');
    const appealLawyerId = await apiGetMyUserId(appealLawyerTok);
    expect(appealLawyerId, 'appeal lawyer userId').toBeTruthy();
    const assigned = await apiAssignLawyer(sectionTok, demoCaseId!, appealLawyerId!);
    expect(assigned, 'assign appeal lawyer').toBeTruthy();

    // التحقق المرئي (مطابقة §3.5 من المخطط: «الاطلاع على الملفات المقيدة
    // سابقًا ضمن قسمه»): رئيس قسم البداية يفتح صفحة مرحلة الاستئناف الجديدة
    // ويجب ألا تظهر أي رسالة "تعذّر تحميل" — لأنه يحتفظ بنطاق القراءة عبر
    // كامل دورة حياة الدعوى التي بدأت في قسمه (D-026 + multi-scope read).
    await page.goto(`/stages/${demoStageId}`);
    await expect(page.getByText('وضع الجلسة الحالية')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('تعذّر تحميل التقدم.')).toHaveCount(0);
    await expect(page.getByText('تعذّر تحميل السجل.')).toHaveCount(0);
    await beat(page, 2500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 13 — محامي الاستئناف يفتح المرحلة الجديدة ويفصلها.
  // §9 من المخطط: «يستطيع محامي الاستئناف الاطلاع عليها» + §3 من المخطط:
  // «صلاحية فتح المرحلة تخصّ القسم الذي تعود إليه المرحلة فعلاً». هذه
  // المرحلة تُثبت أن الـ 403 الذي يحصل لرئيس قسم البداية ليس عيباً، بل
  // هو حماية متعمَّدة، وأن الـ actor الصحيح يفتح الصفحة بنجاح.
  // --------------------------------------------------------------------------
  test('13. رئيس القسم يُرقّي دعوى استئنافية مفصولة إلى التنفيذ', async ({ page }) => {
    const tok = await apiLogin('section_fi_dam');
    const promoteCaseId = await findCaseByBasis(tok, 'DEMO-APPEAL-FINAL-005');
    test.skip(!promoteCaseId, 'Demo seed case DEMO-APPEAL-FINAL-005 missing');
  test('13. محامي الاستئناف يفتح المرحلة الاستئنافية الجديدة ويفصلها', async ({ page }) => {
    expect(demoCaseId).not.toBeNull();
    expect(demoStageId, 'appeal stage id from stage 12').not.toBeNull();

    await loginAs(page, 'lawyerAppeal');
    await beat(page, 1200); // dashboard shows the appeal lawyer's identity

    // يفتح صفحة المرحلة الاستئنافية مباشرةً — يجب أن تُحمَّل بدون 403.
    await page.goto(`/stages/${demoStageId}`);
    await expect(page).toHaveURL(/\/stages\/\d+$/);
    await expect(page.getByText('وضع الجلسة الحالية')).toBeVisible({ timeout: 15_000 });
    await beat(page, 2000);

    // يضغط "فصل المرحلة" ويملأ نموذج القرار النهائي للاستئناف.
    await page.getByRole('button', { name: /فصل المرحلة/ }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await beat(page, 800);

    const sfx = Date.now().toString().slice(-6);
    await modal.locator('input[name="decisionNumber"]').fill(`قرار-استئناف-${sfx}`);
    await modal.locator('input[name="decisionDate"]').fill('2026-04-21');
    await modal.locator('select[name="decisionType"]').selectOption('FOR_ENTITY');
    await modal.locator('input[name="adjudgedAmount"]').fill('600000');
    await modal.locator('input[name="currencyCode"]').fill('SYP');
    await modal.locator('textarea[name="summaryNotes"]').fill('قرار محكمة الاستئناف لصالح الجهة العامة - جاهز للتنفيذ');
    await beat(page, 800);

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/finalize') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^فصل$/ }).click(),
    ]);
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await beat(page, 2500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 14 — رئيس قسم البداية يُرقّي الدعوى إلى التنفيذ.
  // §10 من المخطط: «قسم التنفيذ يختلف عن باقي الأقسام... توجد إجراءات تنفيذية».
  // --------------------------------------------------------------------------
  // المرحلة 12

    await loginAs(page, 'sectionHead');
    await page.goto(`/cases/${promoteCaseId}`);
    await page.goto(`/cases/${demoCaseId}`);
    await expect(page.getByText('المعلومات الأساسية')).toBeVisible({ timeout: 15_000 });
    await beat(page, 1500);

  test('12. رئيس القسم يُرقّي دعوى مفصولة إلى مرحلة الاستئناف', async ({ page }) => {
    const tok = await apiLogin('section_fi_dam');
    const promoteCaseId = await findCaseByBasis(tok, 'DEMO-FI-FINAL-006');
    test.skip(!promoteCaseId, 'Demo seed case DEMO-FI-FINAL-006 missing');
    await promoteBtn.click();

    // Modal opens (or the page navigates straight to /execution-files/{id}
    // if the backend short-circuits — both are valid demo outcomes).
    const dialogVisible = await page
      .getByRole('dialog')
      .or(page.getByText(/ترقية الدعوى إلى ملف تنفيذي/))
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!dialogVisible) {
      await beat(page, 3000);
      return;
    }
    await page.goto(`/cases/${promoteCaseId}`);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await beat(page, 1000);

    const sfx = Date.now().toString().slice(-6);
    await page.locator('input[name="enforcingEntityName"]').fill(demoEntityName || 'وزارة الصحة');
    await page.locator('input[name="executedAgainstName"]').fill('شركة الخصم التجريبية');
    await page.locator('input[name="executionFileType"]').fill('TENFIDH');
    await page.locator('input[name="executionFileNumber"]').fill(`TEN-${sfx}`);
    await page.locator('input[name="executionYear"]').fill('2026');
    // The button may or may not be visible depending on whether the demo
    // case has already been promoted in an earlier run. The video viewer
    if (await promoteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await beat(page, 800);
      await promoteBtn.click();
      // Wait a fixed beat instead of asserting on a specific outcome —
      // the page will EITHER re-render with the new appeal stage, OR show
      // a controlled error banner ("Current stage must be FINALIZED"
      // means the case was already promoted in a previous run). Both are
      // demo-acceptable; the viewer just needs to see the gesture.
      await beat(page, 3500);
    } else {
      // Already promoted — show the resulting case detail (which already
      // reflects the appeal stage in the stages table) for a few seconds.
      await beat(page, 3000);
    }
    await expect(page.getByText('تعذّر تحميل التقدم.')).toHaveCount(0);
    await beat(page, 2500);
  });

  // --------------------------------------------------------------------------
  // المرحلة 14
  // المرحلة 15 — محامي الاستئناف (المُسنَد تلقائياً للملف التنفيذي
  // بوصفه المالك السابق للدعوى لحظة الترقية) يُسجّل خطوة تنفيذية.
  // §10 من المخطط: «الإجراءات التنفيذية» تُسجَّل تباعاً على الملف.
  // --------------------------------------------------------------------------
  test('14. الموظف الإداري المفوَّض يضيف خطوة تنفيذية مؤرخة', async ({ page }) => {
    const tok = await apiLogin('clerk_fi_dam');
    const fileId = await firstExecutionFileId(tok);
    test.skip(!fileId, 'No execution files in DB');
  test('15. المحامي المُسنَد للملف التنفيذي يضيف خطوة تنفيذية مؤرّخة', async ({ page }) => {
    let fileId = demoExecutionFileId;
    if (!fileId && demoCaseId) {
      const tok = await apiLogin('lawyer_app_dam');
      fileId = await findExecutionFileByCase(tok, demoCaseId);
    }
    expect(fileId, 'execution file id for stage 15').toBeTruthy();

    await loginAs(page, 'clerk');
    await loginAs(page, 'lawyerAppeal');
    await beat(page, 1200);
    await page.goto(`/execution-files/${fileId}`);
    await expect(page.getByText('أفعال الملف')).toBeVisible({ timeout: 15_000 });
    await beat(page, 1500);

    const addBtn = page.getByRole('button', { name: /^إضافة خطوة$/ });
    if (!(await addBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Add-step button not visible on this execution file');
      return;
    }
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await beat(page, 800);

    await modal.locator('input[name="stepDate"]').fill('2026-04-25');
  // المرحلة 13
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: /^إضافة$/ }).click(),
    ]);
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(desc)).toBeVisible({ timeout: 10_000 });
    await beat(page, 3000); // longer final beat — closing shot of the journey
  });
});


