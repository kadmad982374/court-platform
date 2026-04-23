# UI NAVIGATION MODEL

> نموذج التنقل العام للواجهة. **Phase 8** أنشأ الـ foundation، و**Phase 9**
> أضاف قسم "الأعمال" (الدعاوى/سجل الفصل/التنفيذ). أي توسعة لاحقة لإضافة
> أقسام جديدة تتم عند بناء صفحاتها الفعلية.

---

## 1) المبدأ

- مصدر الحقيقة: `src/features/navigation/navItems.ts`.
- كل عنصر تنقل يحمل `to` و `label` و `allowedRoles` و `section` اختياري.
- `visibleItems(userRoles)` = عنصر واحد على الأقل من `allowedRoles` يجب أن
  يطابق دور المستخدم. **قائمة فارغة من الأدوار للمستخدم ⇒ لا يرى شيئًا** —
  مقصود (نمنع gating ضمني عبر "أي مستخدم").
- الـ `RoleType` المرجعي = backend `sy.gov.sla.access.domain.RoleType`.

---

## 2) الأدوار المعتمدة (مطابقة 1:1 مع backend)

| Role | عربي |
|---|---|
| `CENTRAL_SUPERVISOR`   | مشرف مركزي |
| `BRANCH_HEAD`          | رئيس فرع |
| `SECTION_HEAD`         | رئيس قسم |
| `ADMIN_CLERK`          | موظف إداري |
| `STATE_LAWYER`         | محامي الدولة |
| `READ_ONLY_SUPERVISOR` | مشرف قراءة فقط |
| `SPECIAL_INSPECTOR`    | مفتش خاص |

---

## 3) عناصر التنقل المُسجَّلة (Phase 9)

### قسم: عام
| Path | Label | Roles |
|---|---|---|
| `/dashboard` | الصفحة الرئيسية | كل الأدوار |
| `/profile`   | ملفي الشخصي     | كل الأدوار |

### قسم: الأعمال (Phase 9)
| Path | Label | Roles | ملاحظة |
|---|---|---|---|
| `/cases`             | الدعاوى       | كل الأدوار | Backend يفلتر النطاق (D-021). |
| `/cases/:caseId`     | (تفاصيل دعوى)  | كل الأدوار | لا يظهر في Sidebar، يُفتح من جدول الدعاوى. |
| `/stages/:stageId`   | (تفاصيل مرحلة) | كل الأدوار | لا يظهر في Sidebar، يُفتح من تفاصيل الدعوى. |
| `/resolved-register` | سجل الفصل     | كل الأدوار | Read-only (D-025). |
| `/execution-files`   | التنفيذ        | كل الأدوار | Backend يفلتر النطاق (D-028). |
| `/execution-files/:id` | (تفاصيل ملف تنفيذ) | كل الأدوار | لا يظهر في Sidebar، يُفتح من قائمة التنفيذ. |

### قسم: مرجعيات (Phase 7 read-only — D-042)
| Path | Label | Roles |
|---|---|---|
| `/legal-library`   | المكتبة القانونية   | كل الأدوار |
| `/public-entities` | دليل الجهات العامة  | كل الأدوار |
| `/circulars`       | التعاميم            | كل الأدوار |

### تسجيل الخروج
يُنفَّذ من الـ Header، وليس عبر عنصر تنقل في Sidebar (تجنبًا لتلوّث القائمة).

---

## 4) عناصر **غير** موجودة بعد (مقصود — Phase 10+)

- المرفقات (`/attachments`).
- التذكيرات (`/reminders`).
- الإشعارات (`/notifications`).
- شاشات إدارة (المستخدمين/الأدوار/المكتبة/الجهات/التعاميم).
- إنشاء/تعديل/إسناد دعوى من UI (لا CRUD UI رغم وجود endpoints — Gap #4).

اختبار `navItems.test.ts` يحرس صراحةً عدم تسرّب أيٍّ من الـ paths أعلاه إلى `NAV_ITEMS` المحجوزة لـ Phase 10+.

---

## 5) قواعد سلوك الـ Sidebar

- يُقسّم العناصر حسب `section` (عام / الأعمال / مرجعيات) ويعرض رؤوس أقسام صغيرة.
- يستخدم `<NavLink end>` لتمييز العنصر النشط (`isActive`) بلون brand خفيف.
- مخفي على عرض شاشة `< md` في Phase 8 (mobile drawer مؤجَّل لقرار لاحق).

---

## 6) سياسة الأزرار (Action visibility) — Phase 9

التفاصيل الكاملة في `UI_ROLE_RUNTIME_MATRIX.md`. باختصار:

- **Rollover/Finalize** — للمحامي المُسنَد فقط (D-024)، فقط على مرحلة قابلة للكتابة.
- **Promote to Appeal** — `SECTION_HEAD` أو `ADMIN_CLERK` + `PROMOTE_TO_APPEAL` (D-027).
- **Promote to Execution** — `SECTION_HEAD` أو `ADMIN_CLERK` + `PROMOTE_TO_EXECUTION` (D-030).
- **Add Execution Step** — `assignedUserId` للملف، أو `ADMIN_CLERK` + `ADD_EXECUTION_STEP` (D-031/D-032)، فقط على ملف غير مغلق.

الواجهة فقط تُخفي/تُعطّل؛ الفصل النهائي على backend.

---

## 7) كيف نضيف لاحقًا قسمًا جديدًا (Phase 10+)

1. تأكد أن صفحات الأعمال موجودة فعلًا (لا تضف link قبل الصفحة).
2. أضف عنصرًا في `NAV_ITEMS` مع `allowedRoles` صريحة بحسب D-021/D-027/D-030/D-035/D-036/D-037/D-038/D-042.
3. أضف الـ Route في `app/router.tsx` تحت `RequireAuth` (مع `anyOf=[...]` إن لزم
   تقييد الدخول الكامل لا الإخفاء فقط).
4. أضف helper صلاحيات في `permissions.ts` + اختبار له إن دخلت قاعدة عمل جديدة.
5. حدّث `UI_NAVIGATION_MODEL.md` و `UI_ROLE_RUNTIME_MATRIX.md` ووثيقة الـ Phase الجديدة.
6. حدّث اختبارات الـ navItems.
