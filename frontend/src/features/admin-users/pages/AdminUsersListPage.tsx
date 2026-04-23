// UI sub-phase B — AdminUsersListPage.
//
// Backend contract:
//   GET /api/v1/users  (paginated, NO membershipType — that param routes to
//   the Mini-Phase A handler in UsersController). Filters: role / branchId /
//   departmentId / active / q / page / size.
//
// CENTRAL_SUPERVISOR only (also enforced at route level via RequireAuth).

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/shared/ui/PageHeader';
import { Card, CardBody } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

import { listBranches, listDepartments } from '@/shared/api/lookups';
import { ALL_ROLES, ROLE_LABEL_AR, type RoleCode } from '@/shared/types/domain';

import { useUsersAdminList } from '../hooks/useUsersAdmin';
import { CreateUserModal } from '../components/CreateUserModal';
import type { AdminUsersListParams } from '../api/usersAdmin';

const PAGE_SIZE = 20;

export function AdminUsersListPage() {
  const [role, setRole] = useState<RoleCode | ''>('');
  const [branchId, setBranchId] = useState<number | ''>('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [active, setActive] = useState<'' | 'true' | 'false'>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const branchesQ = useQuery({ queryKey: ['lookup', 'branches'], queryFn: listBranches });
  const departmentsQ = useQuery({
    queryKey: ['lookup', 'departments', branchId],
    queryFn: () => listDepartments(Number(branchId)),
    enabled: !!branchId,
  });

  const filters: AdminUsersListParams = useMemo(() => {
    const f: AdminUsersListParams = { page, size: PAGE_SIZE };
    if (role) f.role = role;
    if (branchId) f.branchId = Number(branchId);
    if (departmentId) f.departmentId = Number(departmentId);
    if (active !== '') f.active = active === 'true';
    if (q.trim()) f.q = q.trim();
    return f;
  }, [role, branchId, departmentId, active, q, page]);

  const listQ = useUsersAdminList(filters);

  const resetFilters = () => {
    setRole(''); setBranchId(''); setDepartmentId('');
    setActive(''); setQ(''); setPage(0);
  };

  const visibleBranches = (branchesQ.data ?? []).filter((b) => b.active);
  const visibleDepartments = (departmentsQ.data ?? []).filter((d) => d.active);

  return (
    <div data-testid="admin-users-page">
      <PageHeader
        title="إدارة المستخدمين"
        subtitle="مرئية للمشرف المركزي فقط (D-047 / D-048). الخادم هو السلطة النهائية."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            data-testid="admin-users-create-button"
          >
            + مستخدم جديد
          </Button>
        }
      />

      <Card className="mb-3">
        <CardBody>
          <form
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-6"
            onSubmit={(e) => { e.preventDefault(); setPage(0); }}
          >
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block text-slate-700">بحث</span>
              <Input
                placeholder="اسم/مستخدم/موبايل"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="admin-users-q"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-700">الدور</span>
              <Select
                value={role}
                onChange={(e) => { setRole(e.target.value as RoleCode | ''); setPage(0); }}
                aria-label="filter-role"
              >
                <option value="">— الكل —</option>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL_AR[r]}</option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-700">الفرع</span>
              <Select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value ? Number(e.target.value) : '');
                  setDepartmentId('');
                  setPage(0);
                }}
                aria-label="filter-branch"
              >
                <option value="">— الكل —</option>
                {visibleBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.nameAr}</option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-700">القسم</span>
              <Select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value ? Number(e.target.value) : '');
                  setPage(0);
                }}
                disabled={!branchId}
                aria-label="filter-department"
              >
                <option value="">— الكل —</option>
                {visibleDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.nameAr}</option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-700">الحالة</span>
              <Select
                value={active}
                onChange={(e) => {
                  setActive(e.target.value as '' | 'true' | 'false');
                  setPage(0);
                }}
                aria-label="filter-active"
              >
                <option value="">— الكل —</option>
                <option value="true">نشط فقط</option>
                <option value="false">معطَّل فقط</option>
              </Select>
            </label>
            <div className="flex items-end gap-2 md:col-span-6">
              <Button type="submit" size="sm">تطبيق</Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                مسح
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {listQ.isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
              <Spinner /> <span>جارٍ التحميل…</span>
            </div>
          )}
          {listQ.isError && (
            <p role="alert" className="text-sm text-red-600">
              {extractApiErrorMessage(listQ.error)}
            </p>
          )}

          {listQ.data && (
            <>
              {listQ.data.content.length === 0 ? (
                <p className="text-sm text-slate-500">لا نتائج.</p>
              ) : (
                <Table data-testid="admin-users-table">
                  <THead>
                    <TR>
                      <TH>الاسم</TH>
                      <TH>اسم المستخدم</TH>
                      <TH>الأدوار</TH>
                      <TH>نشط</TH>
                      <TH>تفاصيل</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {listQ.data.content.map((u) => (
                      <TR key={u.id}>
                        <TD>{u.fullName}</TD>
                        <TD dir="ltr">{u.username}</TD>
                        <TD>
                          <span className="text-xs text-slate-700">
                            {u.roles.map((r) => ROLE_LABEL_AR[r]).join('، ') || '—'}
                          </span>
                        </TD>
                        <TD>{u.active ? 'نعم' : 'لا'}</TD>
                        <TD>
                          <Link
                            to={`/admin/users/${u.id}`}
                            className="text-xs text-brand-700 hover:underline"
                          >
                            فتح
                          </Link>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}

              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>
                  الصفحة {listQ.data.page + 1} من {Math.max(listQ.data.totalPages, 1)}
                  {' '} (إجمالي: {listQ.data.totalElements})
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost" size="sm"
                    disabled={listQ.data.page <= 0}
                    onClick={() => setPage((p) => Math.max(p - 1, 0))}
                    aria-label="prev-page"
                  >
                    السابق
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    disabled={listQ.data.page + 1 >= listQ.data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="next-page"
                  >
                    التالي
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

