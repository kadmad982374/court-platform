import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listCases } from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { Button } from '@/shared/ui/Button';
import { useAuth } from '@/features/auth/AuthContext';
import { canCreateCase } from '@/features/auth/permissions';
import {
  LIFECYCLE_LABEL_AR,
  PUBLIC_ENTITY_POSITION_LABEL_AR,
} from '@/shared/types/domain';

const PAGE_SIZE = 20;

export function CasesListPage() {
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const showCreate = canCreateCase(user);

  const q = useQuery({
    queryKey: ['cases', { page, size: PAGE_SIZE }],
    queryFn: () => listCases(page, PAGE_SIZE),
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
      <Card>
        <CardHeader>
          <CardTitle>القائمة</CardTitle>
        </CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && <p className="text-sm text-red-600">تعذّر تحميل الدعاوى.</p>}

          {q.data && q.data.content.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد دعاوى ضمن نطاقك.</p>
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

