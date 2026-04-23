import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/shared/api/http';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/FormFields';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import {
  DECISION_TYPE_LABEL_AR,
  type DecisionType,
  type ResolvedRegisterEntry,
} from '@/shared/types/domain';

interface Filters {
  year?: string;
  month?: string;
  branchId?: string;
  departmentId?: string;
  decisionType?: DecisionType | '';
}

async function fetchResolved(f: Filters): Promise<ResolvedRegisterEntry[]> {
  const params: Record<string, string | number> = {};
  if (f.year)         params.year         = Number(f.year);
  if (f.month)        params.month        = Number(f.month);
  if (f.branchId)     params.branchId     = Number(f.branchId);
  if (f.departmentId) params.departmentId = Number(f.departmentId);
  if (f.decisionType) params.decisionType = f.decisionType;
  const r = await http.get<ResolvedRegisterEntry[]>('/resolved-register', { params });
  return r.data;
}

export function ResolvedRegisterPage() {
  const [pending, setPending] = useState<Filters>({});
  const [applied, setApplied] = useState<Filters>({});

  const q = useQuery({
    queryKey: ['resolved-register', applied],
    queryFn: () => fetchResolved(applied),
  });

  return (
    <>
      <PageHeader
        title="سجل الفصل"
        subtitle="عرض للقراءة فقط (D-025). النتائج محكومة بنطاق صلاحياتك."
      />

      <Card className="mb-4">
        <CardHeader><CardTitle>الفلاتر</CardTitle></CardHeader>
        <CardBody>
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-5"
            onSubmit={(e) => { e.preventDefault(); setApplied(pending); }}
          >
            <Field label="السنة">
              <Input type="number" value={pending.year ?? ''}
                     onChange={(e) => setPending((p) => ({ ...p, year: e.target.value }))} />
            </Field>
            <Field label="الشهر (1-12)">
              <Input type="number" min={1} max={12} value={pending.month ?? ''}
                     onChange={(e) => setPending((p) => ({ ...p, month: e.target.value }))} />
            </Field>
            <Field label="معرّف الفرع">
              <Input type="number" value={pending.branchId ?? ''}
                     onChange={(e) => setPending((p) => ({ ...p, branchId: e.target.value }))} />
            </Field>
            <Field label="معرّف القسم">
              <Input type="number" value={pending.departmentId ?? ''}
                     onChange={(e) => setPending((p) => ({ ...p, departmentId: e.target.value }))} />
            </Field>
            <Field label="نوع القرار">
              <Select value={pending.decisionType ?? ''}
                      onChange={(e) => setPending((p) => ({ ...p, decisionType: e.target.value as DecisionType | '' }))}>
                <option value="">الكل</option>
                {(['FOR_ENTITY','AGAINST_ENTITY','SETTLEMENT','NON_FINAL'] as DecisionType[]).map((t) => (
                  <option key={t} value={t}>{DECISION_TYPE_LABEL_AR[t]}</option>
                ))}
              </Select>
            </Field>
            <div className="md:col-span-5 flex justify-end gap-2">
              <Button type="button" variant="ghost"
                      onClick={() => { setPending({}); setApplied({}); }}>
                مسح
              </Button>
              <Button type="submit">تطبيق</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>النتائج</CardTitle></CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && <p className="text-sm text-red-600">تعذّر تحميل سجل الفصل.</p>}
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
                  </TR>
                </THead>
                <TBody>
                  {q.data.map((e) => (
                    <TR key={`${e.caseId}-${e.stageId}-${e.decisionId}`}>
                      <TD>#{e.caseId}</TD>
                      <TD>#{e.stageId}</TD>
                      <TD>{e.stageBasisNumber}/{e.stageYear}</TD>
                      <TD>{e.publicEntityName}</TD>
                      <TD>{e.opponentName}</TD>
                      <TD>{e.courtName}</TD>
                      <TD>{e.decisionNumber}</TD>
                      <TD>{e.decisionDate}</TD>
                      <TD>
                        {DECISION_TYPE_LABEL_AR[e.decisionType as DecisionType] ?? e.decisionType}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}


