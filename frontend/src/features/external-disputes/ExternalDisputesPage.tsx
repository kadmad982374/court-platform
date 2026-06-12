// Phase 2 (Damascus registers, #5b) — المنازعات الخارجية register.
//
// Reached via the «قسم الدراسات والمنازعات الخارجية» hub card (NOT a separate
// sidebar entry). It resolves the Damascus branch id and its EXTERNAL_DISPUTES
// department id once, then renders the cases list HARD-FILTERED to that
// departmentId by reusing the existing `listCases(...)` — no new backend
// endpoint.
//
// Columns (EXTERNAL_DISPUTES set in caseTableColumns):
//   رقم المتداول · الجهة · صفتها · الخصم · الجلسة · سبب التأجيل · إجراء

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listCases } from '@/features/cases/api';
import { EXTERNAL_DISPUTES_COLUMNS } from '@/features/cases/caseTableColumns';
import { listBranches, listDepartments } from '@/shared/api/lookups';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, THead, TR } from '@/shared/ui/Table';
import { Button } from '@/shared/ui/Button';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

const PAGE_SIZE = 20;

export function ExternalDisputesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  // 1) Resolve the Damascus branch.
  const branchesQ = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => listBranches(),
    staleTime: 60_000,
  });
  const damascusBranchId = useMemo(
    () => (branchesQ.data ?? []).find((b) => b.code === 'DAMASCUS')?.id,
    [branchesQ.data],
  );

  // 2) Resolve its EXTERNAL_DISPUTES department.
  const departmentsQ = useQuery({
    queryKey: ['lookups', 'departments', damascusBranchId ?? null],
    queryFn: () => listDepartments(damascusBranchId!),
    enabled: damascusBranchId != null,
    staleTime: 60_000,
  });
  const externalDeptId = useMemo(
    () => (departmentsQ.data ?? []).find((d) => d.type === 'EXTERNAL_DISPUTES')?.id,
    [departmentsQ.data],
  );

  const ready = damascusBranchId != null && externalDeptId != null;

  // 3) Hard-filtered cases list.
  const casesQ = useQuery({
    queryKey: ['cases', { page, size: PAGE_SIZE, branchId: damascusBranchId, departmentId: externalDeptId }],
    queryFn: () => listCases(page, PAGE_SIZE, {
      branchId: damascusBranchId,
      departmentId: externalDeptId,
    }),
    enabled: ready,
    placeholderData: (prev) => prev,
  });

  // Reset paging if the resolved department changes.
  useEffect(() => { setPage(0); }, [externalDeptId]);

  const resolving = branchesQ.isLoading || (damascusBranchId != null && departmentsQ.isLoading);
  const resolveFailed =
    (branchesQ.isFetched && damascusBranchId == null)
    || (departmentsQ.isFetched && damascusBranchId != null && externalDeptId == null);

  return (
    <>
      <PageHeader
        title="المنازعات الخارجية"
        subtitle="سجل المنازعات الخارجية (فرع دمشق)."
      />

      <Card>
        <CardHeader><CardTitle>القائمة</CardTitle></CardHeader>
        <CardBody>
          {resolving && <Spinner className="text-brand-600" />}

          {resolveFailed && (
            <p className="text-sm text-red-600">
              تعذّر تحديد سجل المنازعات الخارجية لفرع دمشق.
            </p>
          )}

          {ready && casesQ.isLoading && <Spinner className="text-brand-600" />}
          {ready && casesQ.isError && (
            <p className="text-sm text-red-600">
              {extractApiErrorMessage(casesQ.error, 'تعذّر تحميل السجل.')}
            </p>
          )}

          {ready && casesQ.data && casesQ.data.content.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد قيود مطابقة.</p>
          )}

          {ready && casesQ.data && casesQ.data.content.length > 0 && (
            <>
              <Table>
                <THead>
                  <TR>{EXTERNAL_DISPUTES_COLUMNS.head()}</TR>
                </THead>
                <TBody>
                  {casesQ.data.content.map((c) => (
                    <TR key={c.id}>
                      {EXTERNAL_DISPUTES_COLUMNS.row(c, {
                        onOpen: (id) => navigate(`/cases/${id}`),
                      })}
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <div>
                  الصفحة {casesQ.data.page + 1} من {Math.max(casesQ.data.totalPages, 1)} — الإجمالي{' '}
                  {casesQ.data.totalElements}
                  {casesQ.isFetching && (
                    <Spinner className="ms-2 inline-block h-3 w-3 text-brand-600" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary" size="sm"
                    disabled={page <= 0 || casesQ.isFetching}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    السابق
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    disabled={page + 1 >= casesQ.data.totalPages || casesQ.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
