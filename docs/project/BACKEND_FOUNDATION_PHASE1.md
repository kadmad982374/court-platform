# BACKEND_FOUNDATION_PHASE1
## أساس Backend للمرحلة 1 — organization + identity + access-control

> هذه الوثيقة مرجع تقني سريع لما تم بناؤه فعليًا في Phase 1.
> أي شيء غير مذكور هنا = خارج النطاق المنفَّذ.

---

## 1) Tech Stack المُفعَّل
- Java 21
- Spring Boot 3.3.4
- Spring Web, Spring Data JPA, Spring Security, Spring Validation
- PostgreSQL + Flyway (`flyway-database-postgresql`)
- Springdoc OpenAPI 2.6.0
- jjwt 0.12.6 (HS256)
- Lombok
- Testcontainers (PostgreSQL 16-alpine) + JUnit 5 + Spring Security Test

ملف البناء: `backend/pom.xml`. ملف الإعدادات: `backend/src/main/resources/application.yml`.

## 2) بنية الحزم (Modular Monolith)
```
sy.gov.sla
├── SlaApplication
├── common/                  # أنماط الأخطاء + المعالجة العامة
│   ├── api/ApiError, GlobalExceptionHandler
│   └── exception/AppException, NotFound/Forbidden/BadRequest/Conflict
├── security/                # JWT + Filter + SecurityConfig + SecurityUtils + JwtProperties + CurrentUser
├── organization/
│   ├── domain/    Branch, Department, Court, DepartmentType
│   ├── infrastructure/  *Repository
│   ├── application/  OrganizationService
│   └── api/  OrganizationController + DTOs
├── identity/
│   ├── domain/    User, RefreshToken, PasswordResetCode
│   ├── infrastructure/ *Repository
│   ├── application/  AuthService, UserQueryService, OtpDispatcher (LoggingOtpDispatcher), OtpProperties
│   ├── bootstrap/ BootstrapAdminProperties + BootstrapAdminRunner
│   └── api/  AuthController, UsersController + DTOs
└── access/
    ├── domain/    Role, RoleType, UserRole, MembershipType, UserDepartmentMembership,
    │              UserCourtAccess, UserDelegatedPermission, DelegatedPermissionCode
    ├── infrastructure/ *Repository
    ├── application/  AuthorizationService, AuthorizationContext, AccessControlService
    └── api/  AccessControlController + DTOs
```

## 3) كيانات JPA المنفّذة (9 كيانات للمجال + 2 مساعدتان للهوية)
- **organization**: `Branch`, `Department`, `Court`
- **identity**: `User`, `RefreshToken`, `PasswordResetCode`
- **access**: `Role`, `UserRole`, `UserDepartmentMembership`, `UserCourtAccess`, `UserDelegatedPermission`

> ملاحظة: `RefreshToken` و `PasswordResetCode` مساعدتان أُضيفتا بالقدر اللازم لدعم endpoints الـ auth/forgot/reset كما طلبته الوثيقة الوظيفية §15. لم تُضف أي كيان آخر خارج النطاق.

## 4) Flyway Migrations
| الإصدار | الملف | المحتوى |
|---|---|---|
| V1 | `db/migration/V1__organization.sql` | branches, departments, courts |
| V2 | `db/migration/V2__identity.sql` | users, refresh_tokens, password_reset_codes |
| V3 | `db/migration/V3__access_control.sql` | roles, user_roles, user_department_memberships, user_court_access, user_delegated_permissions |
| V4 | `db/migration/V4__seed_branches_departments_roles.sql` | الفروع الـ14، أقسامها الأربعة، الأدوار السبعة |
| V5 | `db/migration/V5__seed_minimal_courts.sql` | محكمة واحدة لكل (فرع × نوع قسم) كحد أدنى |

Flyway مفعّل، Hibernate `ddl-auto: validate`.

## 5) Seed Data
- 14 فرعًا (دمشق، ريف دمشق، درعا، السويداء، القنيطرة، حمص، حماة، حلب، إدلب، اللاذقية، طرطوس، الحسكة، الرقة، دير الزور).
- 4 أقسام لكل فرع: `CONCILIATION`, `FIRST_INSTANCE`, `APPEAL`, `EXECUTION`.
- 7 أدوار: `CENTRAL_SUPERVISOR`, `BRANCH_HEAD`, `SECTION_HEAD`, `ADMIN_CLERK`, `STATE_LAWYER`, `READ_ONLY_SUPERVISOR`, `SPECIAL_INSPECTOR`.
- محكمة افتراضية واحدة لكل (فرع × نوع قسم) — قابلة للتوسعة لاحقًا عبر migration إداري.
- مستخدم Bootstrap (`CENTRAL_SUPERVISOR`) يُنشأ تلقائيًا عند أول إقلاع إن كان `sla.bootstrap.central-supervisor.enabled=true` (افتراضيًا في dev، **عطّله في الإنتاج بعد إنشاء أول مستخدم حقيقي**). انظر D-018.

## 6) APIs المنفَّذة (Phase 1 فقط)
> Base path: `/api/v1`. كل ما هو خارج هذه القائمة **غير منفّذ** في هذه المرحلة.

### Auth / Identity
| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/auth/login` | عام |
| POST | `/api/v1/auth/refresh-token` | عام (rotation) |
| POST | `/api/v1/auth/logout` | يحتاج توكن صالح في body (refresh) |
| POST | `/api/v1/auth/forgot-password` | عام (لا يكشف وجود الرقم) |
| POST | `/api/v1/auth/reset-password` | عام (يستهلك OTP) |
| GET  | `/api/v1/users/me` | محمي (Bearer) |

### Organization
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/branches` | محمي |
| GET | `/api/v1/branches/{id}/departments` | محمي |
| GET | `/api/v1/courts?branchId=&departmentType=` | محمي |

### Access Control
| Method | Path | Auth |
|---|---|---|
| GET  | `/api/v1/users/{id}/department-memberships` | محمي + نطاق |
| PUT  | `/api/v1/users/{id}/court-access` | محمي + قاعدة §3.5 + D-004 |
| PUT  | `/api/v1/users/{id}/delegated-permissions` | محمي + رئيس القسم لمستخدم ADMIN_CLERK في نفس قسمه |

> أي استدعاء غير مصادق يُرَدّ بـ `401 UNAUTHENTICATED`. أي خرق نطاق يُرَدّ بـ `403 FORBIDDEN`.

## 7) Authorization Foundation
بُنيت `AuthorizationService` كنقطة مركزية لتقييم الصلاحيات في طبقة Application:

### 7.1 `AuthorizationContext` (لقطة)
يبنيها `AuthorizationService.loadContext(userId)` من:
- جميع الأدوار (`UserRole` → `Role.type`)
- جميع عضويات الأقسام (active/inactive)
- جميع المحاكم الممنوحة (active فقط)

### 7.2 قواعد النطاق المُفعَّلة في Phase 1
| المبدأ | الموقع |
|---|---|
| نطاق الإدارة المركزية | `AuthorizationContext.isCentralSupervisor()` + `canReadBranch/Department` |
| نطاق الفرع | `isBranchHeadOf(branchId)` |
| نطاق القسم | `isSectionHeadOf / isAdminClerkOf(branchId, depId)` |
| نطاق المحاكم الممنوحة | `hasCourtAccess(userId, courtId)` |
| حجب صلاحية الموظف الإداري | `hasDelegatedPermission(userId, code)` + `requireCanManageCourtAccess` |
| إدارة التفويض | `requireCanManageDelegations` (رئيس القسم فقط على ADMIN_CLERK في قسمه — D-004) |

### 7.3 Placeholder لمنطق ملكية الدعوى (Phase 2)
دالة `requireCaseOwnership(ctx, ownerLawyerId)` موجودة كـ interface تمهيدية فقط؛ التطبيق الفعلي يحدث عند ظهور `LitigationCase` في المرحلة 2.

### 7.4 Spring Security
- Stateless (`SessionCreationPolicy.STATELESS`)
- BCrypt للكلمات
- `JwtAuthenticationFilter` يضع `CurrentUser` في الـ SecurityContext
- مسارات عامة فقط: `/api/v1/auth/{login,refresh-token,forgot-password,reset-password}`, `/v3/api-docs/**`, `/swagger-ui/**`, `/actuator/health`
- جميع باقي المسارات تتطلب `Bearer`

## 8) الاختبارات
- **Unit (لا تحتاج Docker):**
  - `AuthorizationContextUnitTest` — 4 اختبارات تغطي: مركزي، رئيس قسم، عضوية غير فعّالة، رئيس فرع. ✅ تمر.
- **Integration (تحتاج Docker daemon لتشغيل Testcontainers PostgreSQL):**
  - `OrganizationApiIT` — حماية + قراءة الفروع (14) والأقسام (4) والمحاكم.
  - `AuthApiIT` — login، users/me، خطأ كلمة المرور، rejection بدون توكن، تدفق refresh + logout + revocation.
  - `AccessControlApiIT` — منح صلاحية محكمة، رفض خارج فرع actor، قراءة عضويات، رفض تفويض على غير ADMIN_CLERK، رفض المجهول.

> تشغيل الاختبارات الكاملة:
> ```powershell
> cd backend
> mvn test
> ```
> إذا لم يكن Docker daemon شغّالاً، اقصر التشغيل على الوحدات:
> ```powershell
> mvn -Dtest=AuthorizationContextUnitTest test
> ```

## 9) كيف تُشغّل البيئة محليًا
```powershell
# 1) شغّل PostgreSQL محليًا (مثلاً عبر docker)
docker run -d --name sla-pg -p 5432:5432 `
  -e POSTGRES_USER=sla -e POSTGRES_PASSWORD=sla -e POSTGRES_DB=sla postgres:16-alpine

# 2) شغّل التطبيق
cd backend
mvn spring-boot:run

# 3) Swagger UI
# http://localhost:8080/swagger-ui.html
# 4) Bootstrap admin (إن كان مفعّلاً): username=admin password=ChangeMe!2026
```

## 10) ما هو خارج نطاق Phase 1 (للتذكير)
- لا `LitigationCase` ولا أي endpoint للدعاوى.
- لا جلسات/فصل/استئناف/تنفيذ/مرفقات/تذكيرات/إشعارات.
- لا frontend.
- لا أي endpoint غير المذكور في §6.

