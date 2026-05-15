// PR-10 (customer feedback B-3 / C-5) —
// Role-aware filtered resolved-register.
//
// Per role:
//   ADMIN        : year + month + branch + dept + court + decisionType
//   BRANCH_HEAD  : year + month + dept + court + decisionType (branch implicit)
//   SECTION_HEAD : year + month + court + decisionType (dept implicit)
//   ADMIN_CLERK  : same as section_head
//   STATE_LAWYER : year + month + decisionType (their cases auto-scoped)

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { http } from '@/shared/api/http';
import { listBranches, listCourts, listDepartments } from '@/shared/api/lookups';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { ScrollYearPicker } from '@/shared/ui/ScrollYearPicker';
import { Select } from '@/shared/ui/FormFields';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { useAuth } from '@/features/auth/AuthContext';
import { hasRole } from '@/features/auth/permissions';
import {
  DECISION_TYPE_LABEL_AR,
  DEPARTMENT_TYPE_LABEL_AR,
  STAGE_TYPE_LABEL_AR,
  type CurrentUser,
  type DecisionType,
  type Department,
  type DepartmentType,
  type ResolvedRegisterEntry,
} from '@/shared/types/domain';

interface Filters {
  year?: string;
  month?: string;
  branchId?: number;
  departmentId?: number;
  courtId?: number;
  decisionType?: DecisionType | '';
}

async function fetchResolved(f: Filters): Promise<ResolvedRegisterEntry[]> {
  const params: Record<string, string | number> = {};
  if (f.year)         params.year         = Number(f.year);
  if (f.month)        params.month        = Number(f.month);
  if (f.branchId)     params.branchId     = f.branchId;
  if (f.departmentId) params.departmentId = f.departmentId;
  if (f.courtId)      params.courtId      = f.courtId;
  if (f.decisionType) params.decisionType = f.decisionType;
  const r = await http.get<ResolvedRegisterEntry[]>('/resolved-register', { params });
  return r.data;
}

// ──────────────────────────────────────────────────────────────
// Role → which filters to expose (mirrors CasesListPage's detectMode)
// ──────────────────────────────────────────────────────────────
type LawyerSection = { branchId: number; departmentId: number };

type FilterMode =
  | { kind: 'admin' }
  | { kind: 'branch_head'; branchId: number }
  | { kind: 'dept_member'; branchId: number; departmentId: number }
  /** Customer feedback round-2 — see CasesListPage for the rationale. */
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

export function ResolvedRegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = useMemo(() => detectMode(user), [user]);

  const [pending, setPending] = useState<Filters>({});
  const [applied, setApplied] = useState<Filters>({});

  const q = useQuery({
    queryKey: ['resolved-register', applied],
    queryFn: () => fetchResolved(applied),
  });

  return (
    <>
      <PageHeader title="سجل الفصل" />

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

      <Card>
        <CardHeader><CardTitle>النتائج</CardTitle></CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && (
            <p className="text-sm text-red-600">
              {extractApiErrorMessage(q.error, 'تعذّر تحميل سجل الفصل.')}
            </p>
          )}
          {q.data && q.data.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد نتائج بهذه الفلاتر.</p>
          )}
          {q.data && q.data.length > 0 && (
            <>
              <p className="mb-2 text-xs text-slate-500">عدد النتائج: {q.data.length}</p>
              <Table>
                <THead>
                  <TR>
                    <TH>الدعوى</TH>
                    <TH>المرحلة</TH>
                    <TH>رقم الأساس</TH>
                    <TH>الجهة</TH>
                    <TH>الخصم</TH>
                    <TH>المحكمة</TH>
                    <TH>رقم القرار</TH>
                    <TH>تاريخ القرار</TH>
                    <TH>نوع القرار</TH>
                    {/* PR-8 (A-5/B-4): row open action — drill into the case detail. */}
                    <TH className="text-end">إجراء</TH>
                  </TR>
                </THead>
                <TBody>
                  {q.data.map((e) => (
                    <TR key={`${e.caseId}-${e.stageId}-${e.decisionId}`}>
                      <TD>{e.caseBasisNumber}/{e.caseBasisYear}</TD>
                      <TD>{STAGE_TYPE_LABEL_AR[e.stageType] ?? e.stageType}</TD>
                      <TD>{e.stageBasisNumber}/{e.stageYear}</TD>
                      <TD>{e.publicEntityName}</TD>
                      <TD>{e.opponentName}</TD>
                      <TD>{e.courtName}</TD>
                      <TD>{e.decisionNumber}</TD>
                      <TD>{e.decisionDate}</TD>
                      <TD>
                        {DECISION_TYPE_LABEL_AR[e.decisionType as DecisionType] ?? e.decisionType}
                      </TD>
                      <TD className="text-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/cases/${e.caseId}`)}
                        >
                          فتح
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Filter form (role-aware) — same lookup pattern as CasesListPage.
// ──────────────────────────────────────────────────────────────

function FilterForm({
  mode, pending, setPending, onApply, onClear,
}: {
  mode: FilterMode;
  pending: Filters;
  setPending: React.Dispatch<React.SetStateAction<Filters>>;
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

  const memberDeptListQ = useQuery({
    queryKey: ['lookups', 'departments', activeBranchId ?? null, 'for-dept-member'],
    queryFn: () => listDepartments(activeBranchId!),
    enabled: mode.kind === 'dept_member' && activeBranchId != null,
    staleTime: 60_000,
  });

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

  // For dept_member, narrow server-side by dept.
  useEffect(() => {
    if (mode.kind === 'dept_member' && pending.departmentId == null) {
      setPending((p) => ({ ...p, departmentId: mode.departmentId }));
    }
  }, [mode, pending.departmentId, setPending]);

  // Customer feedback round-2: lawyer section picker — see CasesListPage.
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
      className="grid grid-cols-1 gap-3 md:grid-cols-6"
      onSubmit={(e) => { e.preventDefault(); onApply(); }}
    >
      {/* Customer feedback round-2: state-lawyer section picker. */}
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

      <Field label="السنة">
        <ScrollYearPicker
          value={pending.year}
          onChange={(y) => setPending((p) => ({
            ...p, year: y == null ? undefined : String(y),
          }))}
        />
      </Field>
      <Field label="الشهر (1-12)">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={12}
          step={1}
          placeholder="1-12"
          value={pending.month ?? ''}
          onChange={(e) => setPending((p) => ({ ...p, month: e.target.value }))}
        />
      </Field>

      {mode.kind === 'admin' && (
        <Field label="الفرع">
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

      <Field label="نوع القرار">
        <Select
          value={pending.decisionType ?? ''}
          onChange={(e) => setPending((p) => ({
            ...p,
            decisionType: e.target.value as DecisionType | '',
          }))}
        >
          <option value="">الكل</option>
          {(['FOR_ENTITY','AGAINST_ENTITY','SETTLEMENT','NON_FINAL'] as DecisionType[]).map((t) => (
            <option key={t} value={t}>{DECISION_TYPE_LABEL_AR[t]}</option>
          ))}
        </Select>
      </Field>

      <div className="md:col-span-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClear}>مسح</Button>
        <Button type="submit">تطبيق</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
