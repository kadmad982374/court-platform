// UI sub-phase B — AdminUserDetailPage.
//
// Reads `GET /api/v1/users/{id}` (UserAdminDto) and renders 5 sections:
//   1. Basic info (active / fullName / mobileNumber)
//   2. Roles
//   3. Memberships
//   4. Delegated permissions
//   5. Court access
//
// CENTRAL_SUPERVISOR only (also enforced at route level via RequireAuth).

import { Link, useParams } from 'react-router-dom';

import { PageHeader } from '@/shared/ui/PageHeader';
import { Card, CardBody } from '@/shared/ui/Card';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

import { useUserAdmin } from '../hooks/useUsersAdmin';
import { PatchUserForm } from '../components/PatchUserForm';
import { RolesSection } from '../components/RolesSection';
import { MembershipsSection } from '../components/MembershipsSection';
import { DelegationsSection } from '../components/DelegationsSection';
import { CourtAccessSection } from '../components/CourtAccessSection';

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;
  const userQ = useUserAdmin(numericId);

  if (!numericId || Number.isNaN(numericId)) {
    return (
      <>
        <PageHeader title="مستخدم غير صالح" />
        <Card><CardBody><Link to="/admin/users" className="text-brand-700 hover:underline">العودة إلى القائمة</Link></CardBody></Card>
      </>
    );
  }

  return (
    <div data-testid="admin-user-detail-page">
      <PageHeader
        title={userQ.data ? userQ.data.fullName : 'تفاصيل المستخدم'}
        subtitle={userQ.data ? `@${userQ.data.username}` : undefined}
        actions={
          <Link to="/admin/users" className="text-sm text-brand-700 hover:underline">
            ← العودة إلى القائمة
          </Link>
        }
      />

      {userQ.isLoading && (
        <Card><CardBody>
          <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <Spinner /> <span>جارٍ التحميل…</span>
          </div>
        </CardBody></Card>
      )}

      {userQ.isError && (
        <Card><CardBody>
          <p role="alert" className="text-sm text-red-600">
            {extractApiErrorMessage(userQ.error)}
          </p>
        </CardBody></Card>
      )}

      {userQ.data && (
        <div className="space-y-4">
          <PatchUserForm user={userQ.data} />
          <RolesSection userId={userQ.data.id} roles={userQ.data.roles} />
          <MembershipsSection
            userId={userQ.data.id}
            memberships={userQ.data.departmentMemberships}
          />
          <DelegationsSection
            userId={userQ.data.id}
            delegations={userQ.data.delegatedPermissions}
          />
          <CourtAccessSection
            userId={userQ.data.id}
            courtAccess={userQ.data.courtAccess}
          />
        </div>
      )}
    </div>
  );
}

