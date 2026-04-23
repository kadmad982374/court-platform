# DEMO_SEED_DATA_PLAN.md
## خطة بيانات الديمو التجريبية — V22

> **Date:** 2026-04-18  
> **Migration:** `V22__demo_seed_data.sql`  
> **Purpose:** إصلاح BUG-003 + إنشاء بيانات ديمو مترابطة لاختبار كل الفلوهات E2E

---

## 1) المستخدمون التجريبيون

| Username | الدور | كلمة المرور | الفرع | القسم | Court Access | ملاحظات |
|----------|-------|------------|-------|-------|-------------|---------|
| `admin` | CENTRAL_SUPERVISOR | `ChangeMe!2026` | — | — | — | مُنشأ بـ BootstrapAdminRunner |
| `head_dam` | BRANCH_HEAD | `ChangeMe!2026` | دمشق | — | — | V20 |
| `section_fi_dam` | SECTION_HEAD | `ChangeMe!2026` | دمشق | بداية (id=2) | — | V20 |
| `clerk_fi_dam` | ADMIN_CLERK | `ChangeMe!2026` | دمشق | بداية | — | V20 — كل التفويضات بما فيها ASSIGN_LAWYER |
| `clerk2_fi_dam` | ADMIN_CLERK | `ChangeMe!2026` | دمشق | بداية | — | V21 — **بدون** ASSIGN_LAWYER |
| `lawyer_fi_dam` | STATE_LAWYER | `ChangeMe!2026` | دمشق | بداية | ✅ محكمة البداية (id=2) | V20 + **V22 court access** |
| `lawyer2_fi_dam` | STATE_LAWYER | `ChangeMe!2026` | دمشق | بداية | ✅ محكمة البداية (id=2) | V21 + **V22 court access** |
| `lawyer_inactive_fi` | STATE_LAWYER (معطّل) | `ChangeMe!2026` | دمشق | بداية | ❌ لا court access | V21 — `is_active=false` |
| `lawyer_app_dam` | STATE_LAWYER | `ChangeMe!2026` | دمشق | استئناف | ✅ محكمة الاستئناف (id=3) | V21 + **V22 court access** |
| `viewer` | READ_ONLY_SUPERVISOR | `ChangeMe!2026` | — | — | — | V20 |

---

## 2) القضايا التجريبية

### Case 1 — DEMO-FRESH-001 (جاهزة للإسناد)
- **الحالة عند الإنشاء:** `lifecycle=NEW`, `stageStatus=REGISTERED`, لا محامٍ مُسند
- **الجهة:** وزارة المالية (مدعي) ضد شركة الأمل التجارية
- **استخدام الديمو:** اختبار assign-lawyer من الواجهة
- **بعد الإسناد:** يمكن اختبار rollover → finalize → promote

### Case 2 — DEMO-ASSIGNED-002 (مُسندة، قابلة للترحيل والفصل)
- **الحالة:** `lifecycle=ACTIVE`, `stageStatus=IN_PROGRESS`, `owner=lawyer_fi_dam`
- **الجهة:** وزارة الصحة (مدعى عليها) ضد أحمد محمد الخطيب
- **سجل الجلسات:** INITIAL + 1 ROLLOVER
- **التذكيرات:** 1 PENDING + 1 DONE
- **المرفقات:** 1 stage attachment (metadata)
- **استخدام الديمو:** rollover-hearing → finalize → resolved register

### Case 3 — DEMO-FINAL-003 (مفصولة، جاهزة للاستئناف)
- **الحالة:** `lifecycle=ACTIVE`, `stageStatus=FINALIZED`
- **الجهة:** وزارة التربية (مدعي) ضد محمد سعيد العلي
- **القرار:** D-2026-003, FOR_ENTITY, 1,500,000 ل.س.
- **استخدام الديمو:** عرض في Resolved Register + promote-to-appeal

### Case 4 — DEMO-EXEC-004 (في التنفيذ)
- **الحالة:** `lifecycle=IN_EXECUTION`
- **الجهة:** وزارة الدفاع (مدعى عليها) ضد سامر حسن الشامي
- **المراحل:**
  - FI: `PROMOTED_TO_APPEAL`, readOnly, قرار `AGAINST_ENTITY` 500,000 ل.س.
  - APPEAL: `PROMOTED_TO_EXECUTION`, readOnly, قرار `FOR_ENTITY` 750,000 ل.س.
- **ملف التنفيذ:** EX-DEMO-004, حكم مدني, 2 خطوات (طلب تبليغ + تبليغ)
- **استخدام الديمو:** عرض execution files + إضافة خطوات

---

## 3) Execution Files

| File | Case | الجهة المنفذة | المنفذ عليه | النوع | الرقم | الخطوات |
|------|------|--------------|------------|------|------|---------|
| EX-DEMO-004 | Case 4 | وزارة الدفاع | سامر حسن الشامي | حكم مدني | EX-DEMO-004 | 2 (NOTICE_REQUEST + NOTICE_ISSUED) |

---

## 4) Reminders

| Case | المالك | النص | الحالة |
|------|-------|------|--------|
| Case 2 | lawyer_fi_dam | متابعة موعد الجلسة القادمة | PENDING |
| Case 2 | lawyer_fi_dam | مراجعة ملف الدعوى قبل الجلسة | DONE |

---

## 5) Notifications

| المستلم | النوع | الدعوى | مقروء |
|---------|------|--------|-------|
| section_fi_dam | CASE_REGISTERED | Case 1 | ❌ |
| section_fi_dam | CASE_REGISTERED | Case 2 | ✅ |
| section_fi_dam | CASE_REGISTERED | Case 3 | ✅ |
| section_fi_dam | CASE_REGISTERED | Case 4 | ✅ |
| lawyer_fi_dam | LAWYER_ASSIGNED | Case 2 | ❌ |
| lawyer_fi_dam | LAWYER_ASSIGNED | Case 4 | ✅ |

---

## 6) Knowledge Data
موجودة من V17/V18/V19 — لم تُعدَّل:
- 7 فئات مكتبة قانونية + 7 عناصر
- 9 جهات عامة
- 4 تعاميم

---

## 7) سيناريوهات الديمو المقترحة

### سيناريو A — Assign + Rollover
1. Login as `section_fi_dam`
2. Open Case 1 (DEMO-FRESH-001)
3. Assign `lawyer_fi_dam` from dropdown
4. Login as `lawyer_fi_dam`
5. Open Case 1 → Rollover hearing

### سيناريو B — Finalize + Resolved Register
1. Login as `lawyer_fi_dam`
2. Open Case 2 (DEMO-ASSIGNED-002)
3. Rollover → Finalize
4. Login as `section_fi_dam`
5. Open Resolved Register → verify case appears

### سيناريو C — Promote to Appeal
1. Login as `section_fi_dam`
2. Open Case 3 (DEMO-FINAL-003) — already finalized
3. Promote to appeal
4. Assign lawyer to appeal stage → rollover → finalize

### سيناريو D — Execution
1. Login as `section_fi_dam`
2. Open Execution Files → Case 4 (DEMO-EXEC-004)
3. View 2 existing steps
4. Add new execution step

### سيناريو E — Attachments + Reminders + Notifications
1. Login as `lawyer_fi_dam`
2. Open Case 2 → Attachments tab → view existing + upload new
3. Open Case 2 → Reminders → view PENDING + DONE
4. Open Notifications → view + mark as read

