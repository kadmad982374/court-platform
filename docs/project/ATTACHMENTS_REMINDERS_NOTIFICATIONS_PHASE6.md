# ATTACHMENTS_REMINDERS_NOTIFICATIONS_PHASE6

> Phase 6 — وحدات تشغيلية مساندة: المرفقات + التذكيرات + الإشعارات الأساسية.
> هذه الوثيقة تشرح ما تم بناؤه في Phase 6 فقط. لا مكتبة قانونية ولا دليل جهات
> ولا تعاميم ولا أي frontend ولا scheduler ولا قنوات خارجية.

---

## 1) النطاق

ثلاث وحدات backend جديدة:
- `attachments` — رفع/قراءة/تنزيل ملفات مربوطة بـ CASE_STAGE/EXECUTION_FILE/EXECUTION_STEP.
- `reminders` — تذكيرات شخصية على الدعوى.
- `notifications` — إشعارات داخلية + مستهلكان لأحداث المراحل السابقة.

ممنوع في Phase 6: legal library، public entity directory، circulars، frontend،
reporting expansion، scheduler، email/SMS/push، websocket، DELETE/PUT للمرفقات،
notification batching، anti-virus.

---

## 2) Migrations جديدة

| Migration | المحتوى |
|---|---|
| `V14__attachments.sql` | جدول `attachments` + CHECK على `attachment_scope_type` و `file_size_bytes` + UNIQUE على `storage_key` + 3 فهارس. |
| `V15__reminders.sql`   | جدول `reminders` + CHECK على `status` + 3 فهارس. |
| `V16__notifications.sql` | جدول `notifications` + 2 فهارس على المستلم. |

---

## 3) APIs Phase 6 (تحت `/api/v1`)

### Attachments
| Method | Path |
|---|---|
| POST | `/stages/{stageId}/attachments`         (multipart `file`) |
| GET  | `/stages/{stageId}/attachments`         |
| POST | `/execution-files/{id}/attachments`     (multipart `file`) |
| GET  | `/execution-files/{id}/attachments`     |
| GET  | `/attachments/{id}/download`            |

### Reminders
| Method | Path |
|---|---|
| POST  | `/cases/{id}/reminders` |
| GET   | `/cases/{id}/reminders` |
| PATCH | `/reminders/{id}/status` |

### Notifications
| Method | Path |
|---|---|
| GET   | `/notifications?page=&size=` |
| PATCH | `/notifications/{id}/read` |

**خارج Phase 6 صراحةً**: DELETE/PUT للمرفقات، POST يدوي للإشعارات،
endpoints لإسناد ملفات تنفيذية، tagging/categorization للمرفقات.

---

## 4) الكيانات

### 4.1 `Attachment` (D-035, D-036)
كيان موحَّد:
- `id`, `attachment_scope_type` (CASE_STAGE/EXECUTION_FILE/EXECUTION_STEP),
  `scope_id`, `original_filename`, `content_type`, `file_size_bytes`,
  `storage_key` (UNIQUE), `uploaded_by_user_id`, `uploaded_at`,
  `checksum_sha256`, `is_active`.
- كل الحقول `updatable=false` ما عدا `is_active` (محجوز للاستخدام المستقبلي).
- لا setters عمومية ما عدا `setActive` (لا API يكشفه في Phase 6).

### 4.2 `Reminder` (D-037)
- `id`, `litigation_case_id`, `case_stage_id` (nullable), `owner_user_id`,
  `reminder_at` (Instant), `reminder_text` (≤500), `status`, `created_at`.
- كل الحقول `updatable=false` ما عدا `status`.

### 4.3 `Notification` (D-038)
- `id`, `recipient_user_id`, `notification_type` (نص حر، فعليًا
  `CASE_REGISTERED` و `LAWYER_ASSIGNED` في Phase 6), `title`, `body`,
  `related_entity_type` (مثل `LITIGATION_CASE`), `related_entity_id`,
  `is_read`, `created_at`, `read_at`.
- الإنشاء حصري عبر مستهلكي الأحداث (لا API).

---

## 5) Storage strategy للمرفقات (D-035)

طبقة Port + Adapter:
- **Port**: `AttachmentStoragePort` بثلاث عمليات: `store(InputStream, filenameHint) → key`,
  `open(key) → InputStream`, `size(key) → long`.
- **Adapter (Phase 6)**: `LocalFilesystemAttachmentStorage`
  - مجلد جذر قابل للضبط: `sla.attachments.base-dir` (افتراضي `./attachments-data`).
  - شكل المفتاح: `{yyyy}/{MM}/{uuid}__{sanitized_filename}`.
  - تنظيف اسم الملف: حذف المسارات (`/`, `\`)، حذف `..`، استبدال أي حرف غير alnum/`._-` بـ `_`، اقتصاص أعلى 200 حرف.
  - منع path-traversal: التحقق `target.startsWith(baseDir)`.
- **حد أقصى**: 50MB لكل مرفق (مرفوض > 50MB بـ 400 `FILE_TOO_LARGE`).
- **Checksum**: SHA-256 يُحسب ويُخزَّن.

ترقية مستقبلية إلى S3/MinIO تتم باستبدال الـ Adapter فقط.

---

## 6) Reminders model (D-037)

- التذكير شخصي (owner = منشئه).
- `GET /cases/{id}/reminders` يُرجع تذكيرات المستخدم الحالي على هذه الدعوى فقط (لا shared).
- `POST /cases/{id}/reminders` يتطلب أن يكون المستخدم ضمن read-scope الدعوى (D-021).
- `PATCH /reminders/{id}/status` محصور بمالك التذكير. غير المالك → 403 حتى لو ضمن نطاق الدعوى.
- transitions مدعومة: `PENDING → DONE`, `PENDING → CANCELLED`. لا re-open.

---

## 7) Notifications model + recipients (D-038)

### المستهلكون (event listeners)
- `CaseRegisteredEvent` (من litigationregistration) ⇒ `CASE_REGISTERED` لكل من:
  - أعضاء `SECTION_HEAD` النشطين في `(branchId, departmentId)`.
  - أعضاء `ADMIN_CLERK` النشطين في نفس `(branchId, departmentId)`.
  - المحامي المُسنَد عند الإنشاء (`initialOwnerUserId`) إن وُجد.
- `LawyerAssignedEvent` ⇒ `LAWYER_ASSIGNED` للمحامي المُسنَد فقط.

### عزل الفشل
كل listener `@Transactional(propagation = REQUIRES_NEW)` بحيث لا يُسقط فشل
الإشعار الكتابة الأصلية للدعوى/الإسناد.

### الصلاحيات
- `GET /notifications` يُرجع فقط `recipient_user_id == actorUserId`.
- `PATCH /notifications/{id}/read` يُرفض على إشعار مستخدم آخر (403).
- لا API لإنشاء إشعار يدويًا.

### الأحداث غير المربوطة في Phase 6
- `CasePromotedToAppealEvent`, `CasePromotedToExecutionEvent`,
  `ExecutionStepAddedEvent`, `CaseFinalizedEvent` — موجودة كأحداث منشورة
  لكن **بلا مستهلك notifications** في Phase 6 (D-038).

---

## 8) قواعد الصلاحيات للمرفقات (D-036)

| Scope | List/Download | Upload |
|---|---|---|
| CASE_STAGE | D-021 read scope | SECTION_HEAD/ADMIN_CLERK لقسم المرحلة، أو owner lawyer |
| EXECUTION_FILE | D-032 (`ExecutionScope.matches`) | SECTION_HEAD/ADMIN_CLERK لقسم الملف، أو `assigned_user_id == actor` |
| EXECUTION_STEP | يُحال إلى ملفه الأب → D-032 | (غير مكشوفة upload في Phase 6 — لا endpoint) |

`/attachments/{id}/download` يفحص الصلاحية بحسب `attachment_scope_type` المحفوظ
ثم يفتح الـ stream؛ لا تسريب أي بايت خارج النطاق.

---

## 9) ما لم يُنفَّذ هنا (مُؤجَّل لـ Phase 7+)

- المكتبة القانونية + دليل الجهات العامة + التعاميم.
- أي frontend.
- Reminder scheduler / due notification.
- Email/SMS/push channels.
- WebSocket / realtime delivery.
- Attachment versioning / DELETE / soft-delete API / anti-virus.
- Notification batching / digest.
- Notifications على أحداث الترقية والإضافة التنفيذية والفصل (D-038).
- ربط `ExecutionStep` بمرفقات عبر API (مدعوم في DB لكن لا endpoint بعد).
- audit consumer كاملًا.

أي تمدّد لاحق يحتاج قرارًا جديدًا D-040+.

---

## 10) الاختبارات

### Unit (لا Docker) — مضافة في Phase 6
- `AttachmentScopeTypeUnitTest` (1)
- `LocalFilesystemAttachmentStorageUnitTest` (4)
- `ReminderStatusUnitTest` (1)
- `NotificationModelUnitTest` (2)

**نتيجة `mvn test -Dtest=*UnitTest`**: **44/44 ✅** (8 جديدة).

### Integration (Testcontainers) — `AttachmentsRemindersNotificationsIT`
يغطي السيناريوهات 1..17:
- **1+2**: رفع وقراءة مرفق على stage. **3**: رفض خارج scope.
- **4+5**: رفع وقراءة مرفق على execution file.
- **6+7**: download داخل scope وداخل scope وللآخر مرفوض.
- **8**: إنشاء reminder. **9**: قراءة reminders. **10**: رفض خارج scope.
- **11**: تحديث status من المالك. **12**: رفض من غير المالك.
- **13**: `CaseRegisteredEvent` يُولّد إشعارًا للـ section head.
- **14**: `LawyerAssignedEvent` يُولّد إشعارًا للمحامي.
- **15**: `GET /notifications` يُرجع إشعارات المستخدم الحالي فقط.
- **16+17**: `PATCH /read` ينجح للمالك ويُرفض للآخر.

> الـ IT تتطلب Docker daemon للـ Postgres testcontainer.

