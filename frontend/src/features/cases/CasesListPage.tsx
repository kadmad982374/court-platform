// PR-9 (customer feedback A-3 / B-1 / C-1 / D-1) —
// Role-aware filtered cases listing.
//
// Customer rule per role:
//   ADMIN          : branch + dept + court + name search
//   BRANCH_HEAD    : dept + court + name (branch is implicit = their own)
//   SECTION_HEAD   : court + name (dept is implicit = their own)
//   ADMIN_CLERK    : court + name (dept is implicit = their own)
//   STATE_LAWYER   : name search only (their cases auto-scoped server-side)
//
// The backend always applies the role-scope first; the explicit filters narrow
// further with AND. So a branch_head trying to spoof a different branchId via
// devtools still gets server-filtered to their own branch.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { listCases, type ListCasesFilters } from './api';
import { listBranches, listCourts, listDepartments } from '@/shared/api/lookups';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/FormFields';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { useAuth } from '@/features/auth/AuthContext';
import { canCreateCase, hasRole } from '@/features/auth/permissions';
import { CaseSummaryWidget } from '@/features/reports/CaseSummaryWidget';
import {
  DEPARTMENT_TYPE_LABEL_AR,
  LIFECYCLE_LABEL_AR,
  PUBLIC_ENTITY_POSITION_LABEL_AR,
  type CurrentUser,
  type Department,
  type DepartmentType,
} from '@/shared/types/domain';

const PAGE_SIZE = 20;

// ──────────────────────────────────────────────────────────────
// Role → which fields to expose
// ──────────────────────────────────────────────────────────────
type LawyerSection = { branchId: number; departmentId: number };

type FilterMode =
  | { kind: 'admin' }
  | { kind: 'branch_head'; branchId: number }
  | { kind: 'dept_member'; branchId: number; departmentId: number }
  /**
   * Customer feedback round-2: a state lawyer can belong to several sections
   * at once (e.g. one assignment in قسم البداية and another in قسم الاستئناف).
   * `sections` lists the lawyer's active STATE_LAWYER memberships so the UI
   * can render a section picker on the cases page when there are 2+.
   */
  | { kind: 'lawyer'; sections: LawyerSection[] }
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

  const deptMembership = user.departmentMemberships.find(
    (m) => m.active
            && (m.membershipType === 'SECTION_HEAD' || m.membershipType === 'ADMIN_CLERK')
            && m.departmentId != null,
  );
  if (deptMembership && deptMembership.departmentId != null) {
    return {
      kind: 'dept_member',
      branchId: deptMembership.branchId,
      departmentId: deptMembership.departmentId,
    };
  }
  if (hasRole(user, 'STATE_LAWYER')) {
    const sections = user.departmentMemberships
      .filter((m) => m.active
        && m.membershipType === 'STATE_LAWYER'
        && m.departmentId != null)
      .map((m) => ({ branchId: m.branchId, departmentId: m.departmentId as number }));
    return { kind: 'lawyer', sections };
  }
  return { kind: 'none' };
}

// ──────────────────────────────────────────────────────────────

export function CasesListPage() {
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const showCreate = canCreateCase(user);
  const mode = useMemo(() => detectMode(user), [user]);

  const [pending, setPending] = useState<ListCasesFilters>({});
  const [applied, setApplied] = useState<ListCasesFilters>({});

  // Reset paging when a new filter set is applied.
  useEffect(() => { setPage(0); }, [applied]);

  const q = useQuery({
    queryKey: ['cases', { page, size: PAGE_SIZE, ...applied }],
    queryFn: () => listCases(page, PAGE_SIZE, applied),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeader
        title="الدعاوى"
        subtitle="القائمة محكومة بنطاق صلاحياتك (D-021): ترى ما يُعيده الخادم فقط."
        actions={
          showCreate ? (
            <Button onClick={() => navigate('/cases/new')}>+ إنشاء دعوى</Button>
          ) : undefined
        }
      />

      {/* PR-13 (customer feedback A-2 / Q-B): same widget as the dashboard,
          but compact so it doesn't push the cases table below the fold. */}
      {mode.kind !== 'none' && (
        <div className="mb-4">
          <CaseSummaryWidget compact />
        </div>
      )}

      {mode.kind !== 'none' && (
        <Card className="mb-4">
          <CardHeader><CardTitle>الفلاتر</CardTitle></CardHeader>
          <CardBody>
            <FilterForm
              mode={mode}
              pending={pending}
              setPending={setPending}
              onApply={() => setApplied(pending)}
              onClear={() => { setPending({}); setApplied({}); }}
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>القائمة</CardTitle>
        </CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && (
            <p className="text-sm text-red-600">
              {extractApiErrorMessage(q.error, 'تعذّر تحميل الدعاوى.')}
            </p>
          )}

          {q.data && q.data.content.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد دعاوى مطابقة.</p>
          )}

          {q.data && q.data.content.length > 0 && (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>رقم الأساس</TH>
                    <TH>السنة</TH>
                    <TH>الجهة العامة</TH>
                    <TH>الصفة</TH>
                    <TH>الخصم</TH>
                    <TH>تاريخ الجلسة</TH>
                    <TH>الحالة</TH>
                    <TH className="text-end">إجراء</TH>
                  </TR>
                </THead>
                <TBody>
                  {q.data.content.map((c) => (
                    <TR key={c.id}>
                      <TD>{c.originalBasisNumber}</TD>
                      <TD>{c.basisYear}</TD>
                      <TD>{c.publicEntityName}</TD>
                      <TD>{PUBLIC_ENTITY_POSITION_LABEL_AR[c.publicEntityPosition]}</TD>
                      <TD>{c.opponentName}</TD>
                      <TD>{c.lastHearingDate ?? '—'}</TD>
                      <TD>{LIFECYCLE_LABEL_AR[c.lifecycleStatus]}</TD>
                      <TD className="text-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/cases/${c.id}`)}
                        >
                          فتح
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <Pagination
                page={q.data.page}
                totalPages={q.data.totalPages}
                totalElements={q.data.totalElements}
                onChange={setPage}
                fetching={q.isFetching}
              />
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Filter form — renders only the dropdowns appropriate to the role.
// ──────────────────────────────────────────────────────────────

function FilterForm({
  mode, pending, setPending, onApply, onClear,
}: {
  mode: FilterMode;
  pending: ListCasesFilters;
  setPending: React.Dispatch<React.SetStateAction<ListCasesFilters>>;
  onApply: () => void;
  onClear: () => void;
}) {
  // Lookups — branches loaded for admin only; departments + courts load
  // conditionally on selection. Cached via TanStack Query.
  const branchesQ = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => listBranches(),
    enabled: mode.kind === 'admin',
    staleTime: 60_000,
  });

  // Branch ID currently active for dept/court lookups.
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

  // For dept_member, court list is auto-scoped to their dept's TYPE.
  // We need the dept-type for that, which requires an extra lookup since
  // departments-by-branch isn't fetched in dept_member mode.
  const memberDeptListQ = useQuery({
    queryKey: ['lookups', 'departments', activeBranchId ?? null, 'for-dept-member'],
    queryFn: () => listDepartments(activeBranchId!),
    enabled: mode.kind === 'dept_member' && activeBranchId != null,
    staleTime: 60_000,
  });

  // Resolve dept type for the courts query.
  const fixedDeptType: DepartmentType | undefined =
    mode.kind === 'dept_member'
      ? (memberDeptListQ.data ?? []).find((d) => d.id === mode.departmentId)?.type
      : undefined;

  const activeDeptType: DepartmentType | undefined =
    fixedDeptType
      ?? (pending.departmentId != null
          ? (departmentsQ.data ?? []).find((d) => d.id === pending.departmentId)?.type
          : undefined);

  const courtsQ = useQuery({
    queryKey: ['lookups', 'courts', activeBranchId ?? null, activeDeptType ?? null],
    queryFn: () => listCourts({ branchId: activeBranchId, departmentType: activeDeptType }),
    enabled: activeBranchId != null,
    staleTime: 60_000,
  });

  // Auto-fill pending.departmentId for dept_member roles so the backend
  // filter narrows even before the user touches the form.
  useEffect(() => {
    if (mode.kind === 'dept_member' && pending.departmentId == null) {
      setPending((p) => ({ ...p, departmentId: mode.departmentId }));
    }
  }, [mode, pending.departmentId, setPending]);

  // ── Customer feedback round-2: lawyer section picker ────────────
  // For state lawyers with 2+ active STATE_LAWYER memberships, fetch
  // the labels (branch name + department type) for each section so the
  // dropdown reads نicely (e.g. "قسم البداية - دمشق").
  const lawyerSections = mode.kind === 'lawyer' ? mode.sections : [];
  const lawyerBranchIds = useMemo(
    () => Array.from(new Set(lawyerSections.map((s) => s.branchId))),
    [lawyerSections],
  );

  const allBranchesQ = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => listBranches(),
    enabled: lawyerSections.length >= 2,
    staleTime: 60_000,
  });

  const lawyerDeptsQs = useQueries({
    queries: lawyerBranchIds.map((bId) => ({
      queryKey: ['lookups', 'departments', bId],
      queryFn: () => listDepartments(bId),
      staleTime: 60_000,
      enabled: lawyerSections.length >= 2,
    })),
  });

  const lawyerSectionOptions = useMemo(() => {
    if (lawyerSections.length < 2) return [];
    const branchById = new Map((allBranchesQ.data ?? []).map((b) => [b.id, b.nameAr]));
    const deptById = new Map<number, Department>();
    lawyerDeptsQs.forEach((q) => (q.data ?? []).forEach((d) => deptById.set(d.id, d)));
    return lawyerSections.map((s) => {
      const dept = deptById.get(s.departmentId);
      const branchName = branchById.get(s.branchId);
      const deptName = dept ? (dept.nameAr || DEPARTMENT_TYPE_LABEL_AR[dept.type]) : '...';
      return {
        branchId: s.branchId,
        departmentId: s.departmentId,
        label: branchName ? `${deptName} - ${branchName}` : deptName,
      };
    });
  }, [lawyerSections, allBranchesQ.data, lawyerDeptsQs]);

  return (
    <form
      className="grid grid-cols-1 gap-3 md:grid-cols-5"
      onSubmit={(e) => { e.preventDefault(); onApply(); }}
    >
      {/* Customer feedback round-2: state-lawyer with multiple sections — pick which one. */}
      {mode.kind === 'lawyer' && lawyerSectionOptions.length >= 2 && (
        <Field label="القسم">
          <Select
            value={pending.departmentId != null && pending.branchId != null
              ? `${pending.branchId}-${pending.departmentId}`
              : ''}
            onChange={(e) => setPending((p) => {
              const v = e.target.value;
              if (!v) return { ...p, branchId: undefined, departmentId: undefined };
              const [b, d] = v.split('-').map(Number);
              return { ...p, branchId: b, departmentId: d, courtId: undefined };
            })}
          >
            <option value="">جميع أقسامي</option>
            {lawyerSectionOptions.map((o) => (
              <option key={`${o.branchId}-${o.departmentId}`} value={`${o.branchId}-${o.departmentId}`}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {mode.kind === 'admin' && (
        <Field label="الفرع">
          <Select
            value={pending.branchId ?? ''}
            onChange={(e) => setPending((p) => ({
              ...p,
              branchId: e.target.value ? Number(e.target.value) : undefined,
              // changing branch invalidates downstream selections
              departmentId: undefined,
              courtId: undefined,
            }))}
          >
            <option value="">الكل</option>
            {(branchesQ.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.nameAr}</option>
            ))}
          </Select>
        </Field>
      )}

      {(mode.kind === 'admin' || mode.kind === 'branch_head') && (
        <Field label="القسم">
          <Select
            value={pending.departmentId ?? ''}
            disabled={mode.kind === 'admin' && !pending.branchId}
            onChange={(e) => setPending((p) => ({
              ...p,
              departmentId: e.target.value ? Number(e.target.value) : undefined,
              courtId: undefined,
            }))}
          >
            <option value="">الكل</option>
            {(departmentsQ.data ?? []).map((d: Department) => (
              <option key={d.id} value={d.id}>
                {d.nameAr || DEPARTMENT_TYPE_LABEL_AR[d.type]}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {(mode.kind === 'admin' || mode.kind === 'branch_head' || mode.kind === 'dept_member') && (
        <Field label="المحكمة">
          <Select
            value={pending.courtId ?? ''}
            disabled={activeBranchId == null}
            onChange={(e) => setPending((p) => ({
              ...p,
              courtId: e.target.value ? Number(e.target.value) : undefined,
            }))}
          >
            <option value="">الكل</option>
            {(courtsQ.data ?? []).filter((c) => c.active).map((c) => (
              <option key={c.id} value={c.id}>{c.nameAr}</option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="بحث (اسم الجهة / الخصم / رقم الأساس)">
        <Input
          type="text"
          placeholder="مثال: وزارة العدل"
          value={pending.q ?? ''}
          onChange={(e) => setPending((p) => ({ ...p, q: e.target.value || undefined }))}
        />
      </Field>

      <Field label="تاريخ الجلسة">
        <Input
          type="date"
          value={pending.hearingDate ?? ''}
          onChange={(e) => setPending((p) => ({
            ...p,
            hearingDate: e.target.value || undefined,
          }))}
        />
      </Field>

      <div className="md:col-span-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClear}>مسح</Button>
        <Button type="submit">تطبيق</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function Pagination({
  page, totalPages, totalElements, onChange, fetching,
}: {
  page: number; totalPages: number; totalElements: number;
  onChange: (p: number) => void; fetching: boolean;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <div>
        الصفحة {page + 1} من {Math.max(totalPages, 1)} — الإجمالي {totalElements}
        {fetching && <Spinner className="ms-2 inline-block h-3 w-3 text-brand-600" />}
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary" size="sm"
          disabled={page <= 0 || fetching}
          onClick={() => onChange(Math.max(0, page - 1))}
        >
          السابق
        </Button>
        <Button
          variant="secondary" size="sm"
          disabled={page + 1 >= totalPages || fetching}
          onClick={() => onChange(page + 1)}
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
