import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listExecutionFiles, type ListExecutionFilesQuery } from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/FormFields';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import {
  EXECUTION_FILE_STATUS_LABEL_AR,
  type ExecutionFileStatus,
} from '@/shared/types/domain';

export function ExecutionFilesPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<ListExecutionFilesQuery>({ page: 0, size: 20 });
  const [applied, setApplied] = useState<ListExecutionFilesQuery>({ page: 0, size: 20 });

  const q = useQuery({
    queryKey: ['execution-files', applied],
    queryFn: () => listExecutionFiles(applied),
  });

  return (
    <>
      <PageHeader title="ملفات التنفيذ" subtitle="ملفات تنفيذية مستقلة (D-028). القائمة محكومة بنطاقك." />

      <Card className="mb-4">
        <CardHeader><CardTitle>الفلاتر</CardTitle></CardHeader>
        <CardBody>
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-5"
            onSubmit={(e) => { e.preventDefault(); setApplied({ ...pending, page: 0 }); }}
          >
            <FilterField label="معرّف الفرع">
              <Input type="number" value={pending.branchId ?? ''}
                     onChange={(e) => setPending((p) => ({ ...p, branchId: e.target.value ? Number(e.target.value) : undefined }))} />
            </FilterField>
            <FilterField label="معرّف القسم">
              <Input type="number" value={pending.departmentId ?? ''}
                     onChange={(e) => setPending((p) => ({ ...p, departmentId: e.target.value ? Number(e.target.value) : undefined }))} />
            </FilterField>
            <FilterField label="السنة">
              <Input type="number" value={pending.year ?? ''}
                     onChange={(e) => setPending((p) => ({ ...p, year: e.target.value ? Number(e.target.value) : undefined }))} />
            </FilterField>
            <FilterField label="الحالة">
              <Select value={pending.status ?? ''}
                      onChange={(e) => setPending((p) => ({ ...p, status: (e.target.value || undefined) as ExecutionFileStatus | undefined }))}>
                <option value="">الكل</option>
                {(['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'] as ExecutionFileStatus[]).map((s) => (
                  <option key={s} value={s}>{EXECUTION_FILE_STATUS_LABEL_AR[s]}</option>
                ))}
              </Select>
            </FilterField>
            <div className="md:col-span-5 flex justify-end gap-2">
              <Button type="button" variant="ghost"
                      onClick={() => { setPending({ page: 0, size: 20 }); setApplied({ page: 0, size: 20 }); }}>
                مسح
              </Button>
              <Button type="submit">تطبيق</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>الملفات</CardTitle></CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && <p className="text-sm text-red-600">تعذّر تحميل الملفات.</p>}
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

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}


