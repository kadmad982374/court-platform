# BACKEND_GAP_PHASE11_LOOKUPS.md
## Gap موثَّق — قوائم مرجعية مفقودة على HTTP

> توثيق فقط. لا تنفيذ في Phase 11.

---

## 1) `postponement_reasons` — قائمة منسدلة لإنشاء الدعوى
- موجود كجدول مرجعي تستهلكه `litigationprogression` داخليًا (rollover/finalize،
  Phase 3).
- **غير مكشوف عبر HTTP** (لا `GET /api/v1/postponement-reasons`).
- في **Phase 11 / `CreateCasePage`** اعتمدنا نص حر بحسب D-020 (الحقل في
  `case_stages` لا يزال free VARCHAR في القيد التأسيسي). هذا حلٌّ مقبول حاليًا
  ولا يكسر أي عقد.
- **الترقية المقترحة** (mini-phase): كشف
  `GET /api/v1/postponement-reasons` (مصادَق فقط، read-only، تُعيد
  `[{code, labelAr, active, sortOrder}]`).
- بعد ذلك، `CreateCasePage` يستبدل الـ `<textarea>` بـ `<select>` من القائمة،
  ولكن نص حر يبقى مقبولًا في DB لأن العمود VARCHAR (لا تغيير schema مطلوب).

## 2) أسماء فعلية للمستخدمين في صفحات الأعمال
- معالَج بـ `BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md` (نفس endpoint
  `GET /api/v1/users` يكفي).

## 3) `Court.chamberSupport` — الإفادة منه فعليًا
- موجود في `CourtDto` لكن لا تستخدمه الواجهة. عند بناء `assign-lawyer` و
  `chamber name` متقدّم، يمكن إخفاء حقل «اسم الدائرة» إذا
  `chamberSupport=false` للمحكمة المختارة. مفيد لكن غير حرج.

---

**لا يُنفَّذ شيء من هذا في Phase 11.**

