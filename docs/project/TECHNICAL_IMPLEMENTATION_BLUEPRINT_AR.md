# المخطط التقني التنفيذي لنظام إدارة قضايا الدولة السورية
## Technical Implementation Blueprint

> **نوع الوثيقة:** مرجع تقني تنفيذي  
> **لغة الوثيقة:** العربية  
> **الهدف:** تحويل المتطلبات الوظيفية والهيكلية إلى تصور تقني واضح وقابل للتنفيذ من قبل فريق التطوير وCopilot Agents، مع تقليل الغموض والقرارات الارتجالية أثناء البناء.

---

# 1) هدف هذه الوثيقة

هذه الوثيقة هي الطبقة التقنية المكملة للـ Blueprint الوظيفية، وهدفها أن تجيب على الأسئلة التالية:
- ما هي الوحدات التقنية الأساسية في النظام؟
- ما هي الكيانات الرئيسية وعلاقاتها؟
- كيف نمثل الهيكل التنظيمي والصلاحيات؟
- كيف نمثل الدعوى ومراحلها والجلسات والفصل والتنفيذ؟
- كيف نمثل سجل الفصل الشهري دون ازدواجية غير ضرورية؟
- كيف ننفذ الانتقال بين المراحل مثل الاستئناف والتنفيذ؟
- ما هي حالات النظام الرئيسية؟
- ما هي حدود الـ APIs المطلوبة؟
- ما هي قواعد التحقق Validation والقيود الأمنية؟
- كيف يجب أن تُبنى الواجهة الأمامية على هذا الأساس؟

هذه الوثيقة لا تستبدل المتطلبات الوظيفية، بل تترجمها إلى تصميم تقني عملي. وهي مبنية على وصف سير الدعوى وسجل الفصل وصلاحيات المستخدمين والتنبيهات والمكتبة القانونية والمرفقات، وعلى الهيكلية الإدارية للفروع والأقسام والصلاحيات، وعلى تصور الشاشات المطلوبة في الواجهات.

---

# 2) المبدأ العام للتصميم

يجب بناء النظام على أنه **نظام مؤسسي هرمي** لإدارة قضايا الدولة السورية، وليس نظام CRM قانوني عام.

المنطق الحاكم:
1. الهيكل التنظيمي أولًا.
2. الصلاحيات مبنية على التنظيم.
3. الدعوى تملك مراحل قضائية.
4. كل مرحلة لها دورة حياة خاصة.
5. المرحلة السابقة تبقى محفوظة ومقروءة فقط.
6. التنفيذ ليس جلسات، بل إجراءات مؤرخة.
7. سجل الفصل ليس مصدر حقيقة مستقل، بل عرض مشتق من بيانات الفصل.
8. الواجهة يجب أن تعكس الفلو الحقيقي، لا مجرد endpoints متاحة.

---

# 3) البنية التقنية المقترحة

## 3.1 Backend
- Java 21
- Spring Boot 3
- Spring Web
- Spring Data JPA
- Spring Security
- Bean Validation
- PostgreSQL
- Flyway
- Springdoc OpenAPI
- Lombok
- Testcontainers

## 3.2 Frontend
- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Axios
- React Hook Form
- Zod
- Tailwind CSS
- shadcn/ui

## 3.3 نمط المعمارية
الموصى به:
- **Modular Monolith**
- تقسيم واضح للوحدات
- فصل قوي بين:
  - Domain
  - Application
  - Infrastructure
  - API

---

# 4) الوحدات التقنية الأساسية

1. identity
2. organization
3. access-control
4. litigation-registration
5. litigation-progression
6. decision-finalization
7. resolved-register
8. stage-transition
9. execution
10. attachments
11. reminders
12. notifications
13. legal-library
14. public-entity-directory
15. circulars
16. reporting
17. audit

---

# 5) الكيانات الرئيسية

## 5.1 الكيانات التنظيمية
### Branch
- id
- code
- name_ar
- province_name
- is_active

### Department
- id
- branch_id
- type (CONCILIATION, FIRST_INSTANCE, APPEAL, EXECUTION)
- name_ar
- is_active

### Court
- id
- branch_id
- department_type
- name_ar
- chamber_support
- is_active

## 5.2 الكيانات الأمنية والتنظيمية
### User
- id
- username
- full_name
- mobile_number
- password_hash
- is_active
- is_locked
- default_branch_id
- default_department_id
- created_at
- last_login_at

### Role
الأدوار التقنية المقترحة:
- CENTRAL_SUPERVISOR
- BRANCH_HEAD
- SECTION_HEAD
- ADMIN_CLERK
- STATE_LAWYER
- READ_ONLY_SUPERVISOR
- SPECIAL_INSPECTOR

### UserRole
ربط المستخدم بالأدوار.

### UserDepartmentMembership
- id
- user_id
- branch_id
- department_id
- membership_type
- is_primary
- is_active

### UserCourtAccess
- id
- user_id
- court_id
- granted_by_user_id
- granted_at
- is_active

### UserDelegatedPermission
- id
- user_id
- permission_code
- granted
- granted_by_user_id
- granted_at

## 5.3 الكيانات القضائية
### LitigationCase
يمثل هوية الملف الأصلية.
- id
- public_entity_name
- public_entity_position
- opponent_name
- original_basis_number
- basis_year
- original_registration_date
- created_branch_id
- created_department_id
- created_court_id
- chamber_name
- current_stage_id
- current_owner_user_id
- lifecycle_status
- created_by_user_id
- created_at
- updated_at

### CaseStage
يمثل مرحلة من مراحل الدعوى.
- id
- litigation_case_id
- stage_type (CONCILIATION, FIRST_INSTANCE, APPEAL)
- branch_id
- department_id
- court_id
- chamber_name
- stage_basis_number
- stage_year
- assigned_lawyer_user_id
- stage_status
- parent_stage_id
- is_read_only
- started_at
- ended_at

### HearingProgressionEntry
- id
- case_stage_id
- hearing_date
- postponement_reason
- entered_by_user_id
- entry_type (INITIAL, ROLLOVER, FINALIZED)
- created_at

### CaseDecision
- id
- case_stage_id
- decision_number
- decision_date
- decision_type
- adjudged_amount
- currency_code
- summary_notes
- finalized_by_user_id
- finalized_at

أنواع القرار:
- FOR_ENTITY
- AGAINST_ENTITY
- SETTLEMENT
- NON_FINAL

## 5.4 التنفيذ
### ExecutionFile
- id
- litigation_case_id
- source_stage_id
- enforcing_entity_name
- executed_against_name
- execution_file_type
- execution_file_number
- execution_year
- branch_id
- department_id
- assigned_user_id
- status
- created_at
- created_by_user_id

### ExecutionAction
- id
- execution_file_id
- action_date
- action_type
- action_description
- created_by_user_id
- created_at

## 5.5 المرفقات
### Attachment
- id
- attachment_scope_type (CASE_STAGE, EXECUTION_FILE, EXECUTION_ACTION)
- scope_id
- original_filename
- content_type
- file_size_bytes
- storage_key
- uploaded_by_user_id
- uploaded_at
- checksum_sha256
- is_active

## 5.6 التذكيرات والإشعارات
### Reminder
- id
- litigation_case_id
- case_stage_id
- owner_user_id
- reminder_at
- reminder_text
- status (PENDING, DONE, CANCELLED)
- created_at

### Notification
- id
- recipient_user_id
- notification_type
- title
- body
- related_entity_type
- related_entity_id
- is_read
- created_at
- read_at

## 5.7 المعرفة والجهات
### LegalCategory
### LegalLibraryItem
### PublicEntityCategory
### PublicEntityItem
### Circular

---

# 6) العلاقات الرئيسية

- Branch 1..* Department
- Department 1..* UserDepartmentMembership
- User 1..* UserDepartmentMembership
- User 1..* UserCourtAccess
- LitigationCase 1..* CaseStage
- CaseStage 1..* HearingProgressionEntry
- CaseStage 0..1 CaseDecision
- LitigationCase 0..* Reminder
- CaseStage 0..* Attachment
- ExecutionFile 1..* ExecutionAction
- ExecutionFile / ExecutionAction 0..* Attachment

---

# 7) نمذجة الحالات

## 7.1 حالة الدعوى الأصلية
- NEW
- ACTIVE
- IN_APPEAL
- IN_EXECUTION
- CLOSED

## 7.2 حالة المرحلة القضائية
- REGISTERED
- ASSIGNED
- IN_PROGRESS
- FINALIZED
- PROMOTED_TO_APPEAL
- PROMOTED_TO_EXECUTION
- ARCHIVED

## 7.3 حالة الملف التنفيذي
- OPEN
- IN_PROGRESS
- COMPLETED
- ARCHIVED

## 7.4 حالات التذكير
- PENDING
- DONE
- CANCELLED

---

# 8) قواعد الانتقال

## 8.1 إنشاء دعوى جديدة
- ينشأ LitigationCase
- تنشأ CaseStage أولى
- stage_status = REGISTERED

## 8.2 الإسناد لمحامٍ
- assigned_lawyer_user_id يتحدد
- stage_status = ASSIGNED أو IN_PROGRESS

## 8.3 ترحيل جلسة
- لا نعدل السجل السابق
- ننشئ HearingProgressionEntry جديدة
- آخر Entry هي المستخدمة في العرض الحالي

## 8.4 فصل الدعوى
- ننشئ CaseDecision
- stage_status = FINALIZED
- تظهر منطقيًا في سجل الفصل

## 8.5 نقلها للاستئناف
- المرحلة القديمة تصبح read-only
- تنشأ CaseStage جديدة من نوع APPEAL
- ترتبط بـ parent_stage_id

## 8.6 نقلها للتنفيذ
- المرحلة القضائية تغلق أو تؤرشف
- ينشأ ExecutionFile مستقل

---

# 9) الصلاحيات التقنية التفصيلية

## 9.1 رئيس الإدارة / الإشراف المركزي
- scope: كل الفروع
- access: read-only افتراضيًا
- يمكنه رؤية:
  - الدعاوى
  - المراحل
  - تاريخ الجلسات
  - سجل الفصل
  - التنفيذ
  - المرفقات
  - المكتبة
  - دليل الجهات
  - التقارير

## 9.2 رئيس الفرع
- scope: فرعه فقط
- access: read-only افتراضيًا

## 9.3 رئيس القسم
- scope: قسمه فقط
- can:
  - create case
  - edit basic data
  - assign lawyer
  - finalize directly in specific cases
  - correct finalized case in limited way
  - grant/revoke court access

## 9.4 الموظف الإداري
- scope: قسمه فقط
- permissions = delegated subset or full copy of section head

## 9.5 محامي الدولة
- scope: دعاواه المسندة فقط
- can:
  - view own stages
  - rollover hearings
  - finalize
  - add reminders
  - manage allowed attachments
  - work execution if assigned
- cannot:
  - view another lawyer’s files
  - edit archived previous stage

## 9.6 المشرف ذو القراءة فقط
- scope: configured
- read only

## 9.7 مستخدمو الاطلاع الخاصون
- scope: configured
- read only
- branch-specific أو global

---

# 10) حدود الـ APIs

## 10.1 Authentication
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh-token
- POST /api/v1/auth/logout
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/reset-password
- GET /api/v1/users/me

## 10.2 Organization
- GET /api/v1/branches
- GET /api/v1/branches/{id}/departments
- GET /api/v1/courts
- GET /api/v1/courts?branchId=&departmentType=

## 10.3 Users & Access
- GET /api/v1/users
- GET /api/v1/users/{id}
- PUT /api/v1/users/{id}/court-access
- PUT /api/v1/users/{id}/delegated-permissions
- GET /api/v1/users/{id}/department-memberships

## 10.4 Cases
- POST /api/v1/cases
- GET /api/v1/cases
- GET /api/v1/cases/{id}
- PUT /api/v1/cases/{id}/basic-data
- POST /api/v1/cases/{id}/assign-lawyer

## 10.5 Progression
- GET /api/v1/cases/{id}/stages
- GET /api/v1/stages/{stageId}
- GET /api/v1/stages/{stageId}/progression
- GET /api/v1/stages/{stageId}/hearing-history
- POST /api/v1/stages/{stageId}/rollover-hearing
- POST /api/v1/stages/{stageId}/finalize

## 10.6 Resolved Register
- GET /api/v1/resolved-register/months
- GET /api/v1/resolved-register/{year}/{month}

## 10.7 Appeal Promotion
- POST /api/v1/stages/{stageId}/promote-to-appeal
- GET /api/v1/stages/{stageId}/previous-stage-history

## 10.8 Execution
- POST /api/v1/execution-files
- GET /api/v1/execution-files
- GET /api/v1/execution-files/{id}
- POST /api/v1/execution-files/{id}/actions
- GET /api/v1/execution-files/{id}/actions
- POST /api/v1/stages/{stageId}/promote-to-execution

## 10.9 Attachments
- POST /api/v1/stages/{stageId}/attachments
- GET /api/v1/stages/{stageId}/attachments
- POST /api/v1/execution-files/{id}/attachments
- GET /api/v1/execution-files/{id}/attachments
- GET /api/v1/attachments/{id}/download

## 10.10 Reminders
- POST /api/v1/cases/{id}/reminders
- GET /api/v1/cases/{id}/reminders
- PATCH /api/v1/reminders/{id}/status

## 10.11 Notifications
- GET /api/v1/notifications
- PATCH /api/v1/notifications/{id}/read

## 10.12 Legal Library
- GET /api/v1/legal-library/categories
- GET /api/v1/legal-library/items
- GET /api/v1/legal-library/items/{id}

## 10.13 Public Entity Directory
- GET /api/v1/public-entities
- GET /api/v1/public-entities/{id}

## 10.14 Circulars
- GET /api/v1/circulars
- GET /api/v1/circulars/{id}

## 10.15 Reporting
- GET /api/v1/reports/central-summary
- GET /api/v1/reports/branch-summary
- GET /api/v1/reports/department-summary
- GET /api/v1/reports/lawyer-workload

---

# 11) قواعد التحقق Validation

## 11.1 عند إنشاء الدعوى
- branch/department/court must be coherent
- original_registration_date required
- basis number required
- first hearing date required
- first postponement reason required

## 11.2 عند الإسناد
- lawyer must belong to department
- lawyer must have court access
- assigning user must have permission

## 11.3 عند ترحيل الجلسة
- next hearing date required
- new postponement reason required
- actor must be assigned lawyer or explicitly allowed exceptional role

## 11.4 عند الفصل
- decision number required
- decision date required
- decision type required
- amount optional depending on type
- summary optional but recommended

## 11.5 عند إنشاء الملف التنفيذي
- execution file number required
- year required
- executed_against required

---

# 12) التدقيق Audit

يجب تسجيل أحداث audit على الأقل في الحالات التالية:
- login success/failure
- case created
- case basic data updated
- lawyer assigned
- hearing rolled over
- case finalized
- case promoted to appeal
- case promoted to execution
- execution action created
- attachment uploaded
- reminder created
- notification generated
- court access changed
- delegated permission changed

ويجب أن يتضمن كل audit row:
- actor_user_id
- action_code
- entity_type
- entity_id
- timestamp
- branch_scope
- optional details_json

---

# 13) التصميم الأمامي المتوقع

## 13.1 المبادئ
- Arabic-first
- RTL
- low-cognitive-load
- role-aware navigation
- simple action placement
- no dead-end screens

## 13.2 الوحدات الأمامية الرئيسية
- تسجيل الدخول / الحساب
- لوحة رئيسية حسب الدور
- قيد دعوى جديدة
- قائمة دعاوى القسم
- قائمة دعاوى المحامي
- تفاصيل الدعوى
- جلسات اليوم
- سجل الفصل
- الملفات التنفيذية
- المرفقات
- التذكيرات
- الإشعارات
- المكتبة القانونية
- دليل الجهات
- القرارات والتعاميم
- التقارير

## 13.3 التفرقة حسب الدور
- المحامي يرى "دعاواي"
- رئيس القسم يرى "دعاوى القسم"
- رئيس الفرع يرى نظرة فرعية للقراءة
- الإدارة المركزية ترى نظرة مركزية للقراءة
- المستخدمون الرقابيون يرون views مخصصة للقراءة فقط

---

# 14) استراتيجية التنفيذ المرحلي

## المرحلة 0
- Freeze الوثائق
- اعتماد الـ Blueprint الوظيفية والتقنية

## المرحلة 1
- organization + identity + access-control

## المرحلة 2
- litigation registration + ownership

## المرحلة 3
- hearing progression + finalization

## المرحلة 4
- resolved register + appeal transition

## المرحلة 5
- execution lifecycle

## المرحلة 6
- attachments + reminders + notifications

## المرحلة 7
- legal library + entities + circulars

## المرحلة 8
- frontend foundation

## المرحلة 9
- runtime role-based UI flows

## المرحلة 10
- final verification + readiness report

---

# 15) ما الذي يجب على Copilot ألا يفعله

1. لا يعيد استخدام role model عام قديم بلا تحقق
2. لا يعامل كل المستخدمين التشغيليين كأنهم متساوون
3. لا يحول التنفيذ إلى hearings
4. لا ينشئ سجل فصل كنسخة بيانات مستقلة بلا داع
5. لا يسمح بتعديل المرحلة السابقة بعد الانتقال إلى الاستئناف
6. لا يعتبر endpoint موجودًا = feature مكتملة
7. لا يربط الواجهة نظريًا فقط دون تحقق runtime
8. لا يوسع صلاحيات الرؤية أو التعديل بسبب الراحة البرمجية

---

# 16) التوجيه النهائي

هذه الوثيقة هي **المرجع التقني التنفيذي** للمشروع.

ويجب استخدامها جنبًا إلى جنب مع الـ Blueprint الوظيفية العربية، بحيث:
- الـ Blueprint الوظيفية تشرح ما يريده الزبون
- وهذه الوثيقة تحدد كيف يُترجم ذلك تقنيًا

وعند التعارض:
1. يُرجع أولًا إلى الـ Blueprint الوظيفية
2. ثم تُفسر هذه الوثيقة بطريقة لا تكسر منطق العميل
3. ثم يُثبت القرار في وثائق المشروع المرحلية
