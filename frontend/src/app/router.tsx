import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppShell } from '@/features/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { LegalLibraryPage } from '@/pages/LegalLibraryPage';
import { PublicEntitiesPage } from '@/pages/PublicEntitiesPage';
import { CircularsPage } from '@/pages/CircularsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { CasesListPage } from '@/features/cases/CasesListPage';
import { CreateCasePage } from '@/features/cases/CreateCasePage';
import { CaseDetailPage } from '@/features/cases/CaseDetailPage';
import { StageDetailPage } from '@/features/cases/StageDetailPage';
import { ResolvedRegisterPage } from '@/features/resolvedregister/ResolvedRegisterPage';
import { ExecutionFilesPage } from '@/features/execution/ExecutionFilesPage';
import { ExecutionFileDetailPage } from '@/features/execution/ExecutionFileDetailPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { LegalLibraryItemDetailPage } from '@/pages/LegalLibraryItemDetailPage';
import { PublicEntityDetailPage } from '@/pages/PublicEntityDetailPage';
import { CircularDetailPage } from '@/pages/CircularDetailPage';
import { AdminUsersListPage } from '@/features/admin-users/pages/AdminUsersListPage';
import { AdminUserDetailPage } from '@/features/admin-users/pages/AdminUserDetailPage';

/**
 * Phase 9 router.
 *
 * Public:
 *   /login
 *
 * Protected (any authenticated user — backend enforces fine-grained scope):
 *   /dashboard, /profile
 *   /cases, /cases/:caseId, /stages/:stageId
 *   /resolved-register
 *   /execution-files, /execution-files/:id
 *   /legal-library, /public-entities, /circulars
 *
 * NOT mounted yet (Phase 10+): attachments / reminders / notifications.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"             element={<DashboardPage />} />
          <Route path="/profile"               element={<ProfilePage />} />

          {/* Phase 9 — business */}
          <Route path="/cases"                 element={<CasesListPage />} />
          <Route path="/cases/new"             element={<CreateCasePage />} />
          <Route path="/cases/:caseId"         element={<CaseDetailPage />} />
          <Route path="/stages/:stageId"       element={<StageDetailPage />} />
          <Route path="/resolved-register"     element={<ResolvedRegisterPage />} />
          <Route path="/execution-files"       element={<ExecutionFilesPage />} />
          <Route path="/execution-files/:id"   element={<ExecutionFileDetailPage />} />

          {/* Phase 10 — notifications (D-038) */}
          <Route path="/notifications"         element={<NotificationsPage />} />

          {/* Phase 7 reference (kept) — Phase 10 added detail pages */}
          <Route path="/legal-library"             element={<LegalLibraryPage />} />
          <Route path="/legal-library/items/:id"   element={<LegalLibraryItemDetailPage />} />
          <Route path="/public-entities"           element={<PublicEntitiesPage />} />
          <Route path="/public-entities/:id"       element={<PublicEntityDetailPage />} />
          <Route path="/circulars"                 element={<CircularsPage />} />
          <Route path="/circulars/:id"             element={<CircularDetailPage />} />

          {/* UI sub-phase B — `/admin/users` minimal (D-047 / D-048).
              CENTRAL_SUPERVISOR only — backend re-validates per request. */}
          <Route element={<RequireAuth anyOf={['CENTRAL_SUPERVISOR']} />}>
            <Route path="/admin/users"     element={<AdminUsersListPage />} />
            <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          </Route>

          <Route path="*"                element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
