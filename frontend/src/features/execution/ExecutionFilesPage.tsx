// PR-12 (customer feedback C-7 / D-2 / E-2 / E-3 / Q-A / Q-E) —
// Role-aware execution-files list with region (= court) filter.
//
// Per role exposure:
//   ADMIN        : branch + dept + court + status + year
//   BRANCH_HEAD  : dept + court + status + year (branch implicit)
//   SECTION_HEAD : court + status + year (branch+dept implicit, see C-7 — file rows only)
//   ADMIN_CLERK  : same as section_head (D-2 — file rows only, no step actions)
//   STATE_LAWYER : court + status + year (assigned-user auto-scoped server-side)
//
// E-3: when ?status=CLOSED is in the URL the page presents itself as the
// "Executed Files" view (renamed sidebar entry).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listExecutionFiles, type ListExecutionFilesQuery } from './api';
import { useAuth } from '@/features/auth/AuthContext';
import { hasRole } from '@/features/auth/permissions';
import { listBranches, listCourts, listDepartments } from '@/shared/api/lookups';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/FormFields';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import {
  EXECUTION_FILE_STATUS_LABEL_AR,
  type CurrentUser,
  type Department,
  type ExecutionFileStatus,
} from '@/shared/types/domain';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

type FilterMode =
  | { kind: 'admin' }
  | { kind: 'branch_head'; branchId: number }
  | { kind: 'dept_member'; branchId: number; departmentId: number }
  | { kind: 'lawyer' }
  | { kind: 'none' };

function detectMode(user: CurrentUser | null): FilterMode {
  if (!user) return { kind: 'none' };
  if (hasRole(user, 'CENTRAL_SUPERVISOR')) return { kind: 'admin' };
  if (hasRole(user, 'READ_ONLY_SUPERVISOR') || hasRole(user, 'SPECIAL_INSPECTOR')) {
    return { kind: 'admin' };
  }
  const branchHead = user.departmentMemberships.find(
    (m) => m.active && m.membershipType === 'BRANCH_HEAD',
  );
  if (branchHead) return { kind: 'branch_head', branchId: branchHead.branchId };
  const dept = user.departmentMemberships.find(
    (m) => m.active
            && (m.membershipType === 'SECTION_HEAD' || m.membershipType === 'ADMIN_CLERK')
            && m.departmentId != null,
  );
  if (dept && dept.departmentId != null) {
    return { kind: 'dept_member', branchId: dept.branchId, departmentId: dept.departmentId };
  }
  if (hasRole(user, 'STATE_LAWYER')) return { kind: 'lawyer' };
  return { kind: 'none' };
}

export function ExecutionFilesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const mode = useMemo(() => detectMode(user), [user]);

  // E-3: ?status=CLOSED arrives from the "Executed Files" sidebar entry.
  const initialStatus = searchParams.get('status') as ExecutionFileStatus | null;
  const isExecutedView = initialStatus === 'CLOSED';

  const seed: ListExecutionFilesQuery = {
    page: 0,
    size: 20,
    ...(initialStatus ? { status: initialStatus } : {}),
  };
  const [pending, setPending] = useState<ListExecutionFilesQuery>(seed);
  const [applied, setApplied] = useState<ListExecutionFilesQuery>(seed);

  // Re-seed when navigating between "ملفات التنفيذ" and "الملفات المنفّذة" (same component).
  useEffect(() => {
    const next: ListExecutionFilesQuery = {
      page: 0,
      size: 20,
      ...(initialStatus ? { status: initialStatus } : {}),
    };
    setPending(next);
    setApplied(next);
  }, [initialStatus]);

  const q = useQuery({
    queryKey: ['execution-files', applied],
    queryFn: () => listExecutionFiles(applied),
  });

  return (
    <>
      <PageHeader
        title={isExecutedView ? 'الملفات المنفّذة' : 'ملفات التنفيذ'}
        subtitle={
          isExecutedView
            ? 'الملفات التنفيذية التي أُغلقت (D-028). محكومة بنطاقك.'
            : 'ملفات تنفيذية مستقلة (D-028). القائمة محكومة بنطاقك.'
        }
      />

      <Card className="mb-4">
        <CardHeader><CardTitle>الفلاتر</CardTitle></CardHeader>
        <CardBody>
          <FilterForm
            mode={mode}
            pending={pending}
            setPending={setPending}
            onApply={() => setApplied({ ...pending, page: 0 })}
            onClear={() => { setPending(seed); setApplied(seed); }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>الملفات</CardTitle></CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && (
            <p className="text-sm text-red-600">
              {extractApiErrorMessage(q.error, 'تعذّر تحميل الملفات.')}
            </p>
          )}
          {q.data && q.data.length === 0 && <p className="text-sm text-slate-500">لا توجد ملفات.</p>}
          {q.data && q.data.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>المعرّف</TH>
                  <TH>الجهة المنفِّذة</TH>
                  <TH>المنفَّذ ضدّه</TH>
                  <TH>النوع/الرقم</TH>
                  <TH>السنة</TH>
                  <TH>المسؤول</TH>
                  <TH>الحالة</TH>
                  <TH className="text-end">إجراء</TH>
                </TR>
              </THead>
              <TBody>
                {q.data.map((f) => (
                  <TR key={f.id}>
                    <TD>{f.id}</TD>
                    <TD>{f.enforcingEntityName}</TD>
                    <TD>{f.executedAgainstName}</TD>
                    <TD>{f.executionFileType} / {f.executionFileNumber}</TD>
                    <TD>{f.executionYear}</TD>
                    <TD>{f.assignedUserId ? `#${f.assignedUserId}` : '—'}</TD>
                    <TD>{EXECUTION_FILE_STATUS_LABEL_AR[f.status]}</TD>
                    <TD className="text-end">
                      <Button size="sm" variant="secondary"
                              onClick={() => navigate(`/execution-files/${f.id}`)}>
                        فتح
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function FilterForm({
  mode, pending, setPending, onApply, onClear,
}: {
  mode: FilterMode;
  pending: ListExecutionFilesQuery;
  setPending: React.Dispatch<React.SetStateAction<ListExecutionFilesQuery>>;
  onApply: () => void;
  onClear: () => void;
}) {
  const branchesQ = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => listBranches(),
    enabled: mode.kind === 'admin',
    staleTime: 60_000,
  });

  const activeBranchId =
    mode.kind === 'branch_head' ? mode.branchId :
    mode.kind === 'dept_member' ? mode.branchId :
    mode.kind === 'admin'       ? pending.branchId :
    undefined;

  const departmentsQ = useQuery({
    queryKey: ['lookups', 'departments', activeBranchId ?? null],
    queryFn: () => listDepartments(activeBranchId!),
    enabled: activeBranchId != null && (mode.kind === 'admin' || mode.kind === 'branch_head'),
    staleTime: 60_000,
  });

  const courtsQ = useQuery({
    queryKey: ['lookups', 'courts', activeBranchId ?? null],
    queryFn: () => listCourts({ branchId: activeBranchId }),
    enabled: activeBranchId != null,
    staleTime: 60_000,
  });

  return (
    <form
      className="grid grid-cols-1 gap-3 md:grid-cols-6"
      onSubmit={(e) => { e.preventDefault(); onApply(); }}
    >
      {mode.kind === 'admin' && (
        <FilterField label="الفرع">
          <Select
            value={pending.branchId ?? ''}
            onChange={(e) => setPending((p) => ({
              ...p,
              branchId: e.target.value ? Number(e.target.value) : undefined,
              departmentId: undefined,
              courtId: undefined,
            }))}
          >
            <option value="">الكل</option>
            {(branchesQ.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.nameAr}</option>
            ))}
          </Select>
        </FilterField>
      )}

      {(mode.kind === 'admin' || mode.kind === 'branch_head') && (
        <FilterField label="القسم">
          <Select
            value={pending.departmentId ?? ''}
            disabled={mode.kind === 'admin' && !pending.branchId}
            onChange={(e) => setPending((p) => ({
              ...p,
              departmentId: e.target.value ? Number(e.target.value) : undefined,
            }))}
          >
            <option value="">الكل</option>
            {(departmentsQ.data ?? []).map((d: Department) => (
              <option key={d.id} value={d.id}>{d.nameAr}</option>
            ))}
          </Select>
        </FilterField>
      )}

      {mode.kind !== 'lawyer' && mode.kind !== 'none' && (
        <FilterField label="المنطقة (المحكمة)">
          <Select
            value={pending.courtId ?? ''}
            disabled={activeBranchId == null}
            onChange={(e) => setPending((p) => ({
              ...p,
              courtId: e.target.value ? Number(e.target.value) : undefined,
            }))}
          >
            <option value="">الكل</option>
            {(courtsQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nameAr}</option>
            ))}
          </Select>
        </FilterField>
      )}

      <FilterField label="السنة">
        <Input
          type="number"
          value={pending.year ?? ''}
          onChange={(e) => setPending((p) => ({
            ...p, year: e.target.value ? Number(e.target.value) : undefined,
          }))}
        />
      </FilterField>

      <FilterField label="الحالة">
        <Select
          value={pending.status ?? ''}
          onChange={(e) => setPending((p) => ({
            ...p, status: (e.target.value || undefined) as ExecutionFileStatus | undefined,
          }))}
        >
          <option value="">الكل</option>
          {(['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'] as ExecutionFileStatus[]).map((s) => (
            <option key={s} value={s}>{EXECUTION_FILE_STATUS_LABEL_AR[s]}</option>
          ))}
        </Select>
      </FilterField>

      <div className="md:col-span-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClear}>مسح</Button>
        <Button type="submit">تطبيق</Button>
      </div>
    </form>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
