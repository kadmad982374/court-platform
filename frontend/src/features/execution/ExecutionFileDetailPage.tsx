import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  addExecutionStep,
  getExecutionFile,
  listExecutionSteps,
} from './api';
import { useAuth } from '@/features/auth/AuthContext';
import { canAddExecutionStep, canUploadExecutionFileAttachment } from '@/features/auth/permissions';
import { AttachmentsSection } from '@/features/attachments/AttachmentsSection';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, Textarea } from '@/shared/ui/FormFields';
import { Modal } from '@/shared/ui/Modal';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  EXECUTION_FILE_STATUS_LABEL_AR,
  EXECUTION_STEP_TYPE_LABEL_AR,
  type AddExecutionStepRequest,
  type ExecutionStepType,
} from '@/shared/types/domain';

export function ExecutionFileDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const { user } = useAuth();

  const fileQ = useQuery({
    queryKey: ['execution-files', id],
    queryFn: () => getExecutionFile(id),
    enabled: Number.isFinite(id),
  });
  const stepsQ = useQuery({
    queryKey: ['execution-files', id, 'steps'],
    queryFn: () => listExecutionSteps(id),
    enabled: Number.isFinite(id),
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const addMut = useMutation({
    mutationFn: (body: AddExecutionStepRequest) => addExecutionStep(id, body),
    onSuccess: () => {
      setActionError(null); setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ['execution-files', id, 'steps'] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  if (!Number.isFinite(id)) return <p className="text-sm text-red-600">معرّف غير صالح.</p>;

  const file = fileQ.data;
  const showAdd = canAddExecutionStep(user, file ?? null);

  return (
    <>
      <PageHeader title={`ملف تنفيذ #${id}`} subtitle="Timeline إجراءات (D-031): الخطوات append-only." />

      {actionError && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>بيانات الملف</CardTitle></CardHeader>
          <CardBody>
            {fileQ.isLoading && <Spinner className="text-brand-600" />}
            {fileQ.isError && <p className="text-sm text-red-600">تعذّر تحميل الملف.</p>}
            {file && (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Field k="الجهة المنفِّذة" v={file.enforcingEntityName} />
                <Field k="المنفَّذ ضدّه"   v={file.executedAgainstName} />
                <Field k="النوع/الرقم"    v={`${file.executionFileType} / ${file.executionFileNumber}`} />
                <Field k="السنة"            v={String(file.executionYear)} />
                <Field k="الفرع/القسم"     v={`#${file.branchId} / #${file.departmentId}`} />
                <Field k="المسؤول"          v={file.assignedUserId ? `#${file.assignedUserId}` : '— (غير مسند)'} />
                <Field k="الحالة"           v={EXECUTION_FILE_STATUS_LABEL_AR[file.status]} />
                <Field k="الدعوى المصدر"   v={`#${file.litigationCaseId}`} />
              </dl>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>أفعال الملف</CardTitle></CardHeader>
          <CardBody>
            <p className="text-xs text-slate-500">
              إضافة خطوة (D-031) متاحة للمسؤول المُسنَد للملف، أو لـ ADMIN_CLERK
              مُفوَّض بـ <code>ADD_EXECUTION_STEP</code>.
            </p>
            <div className="mt-2">
              {showAdd ? (
                <Button onClick={() => setAddOpen(true)}>إضافة خطوة</Button>
              ) : (
                <p className="text-xs text-slate-400">لا تملك صلاحية إضافة خطوة.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>الخطوات (الأقدم أولًا)</CardTitle></CardHeader>
        <CardBody>
          {stepsQ.isLoading && <Spinner className="text-brand-600" />}
          {stepsQ.isError && <p className="text-sm text-red-600">تعذّر تحميل الخطوات.</p>}
          {stepsQ.data && stepsQ.data.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد خطوات بعد.</p>
          )}
          {stepsQ.data && stepsQ.data.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>التاريخ</TH>
                  <TH>النوع</TH>
                  <TH>الوصف</TH>
                  <TH>أُنشئ بتاريخ</TH>
                </TR>
              </THead>
              <TBody>
                {[...stepsQ.data]
                  .sort((a, b) => a.stepDate.localeCompare(b.stepDate))
                  .map((s) => (
                  <TR key={s.id}>
                    <TD>{s.stepDate}</TD>
                    <TD>{EXECUTION_STEP_TYPE_LABEL_AR[s.stepType]}</TD>
                    <TD className="whitespace-pre-wrap">{s.stepDescription}</TD>
                    <TD className="text-xs text-slate-500">{s.createdAt}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <AddStepModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setActionError(null); }}
        submitting={addMut.isPending}
        onSubmit={(b) => addMut.mutate(b)}
      />

      {/* Phase 10 — attachments scoped to this execution file (D-035 / D-036). */}
      <AttachmentsSection
        scope="EXECUTION_FILE"
        fileId={id}
        canUpload={canUploadExecutionFileAttachment(user, file ?? null)}
      />
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-slate-800">{v}</dd>
    </div>
  );
}

const stepSchema = z.object({
  stepDate: z.string().min(1, 'مطلوب'),
  stepType: z.enum([
    'NOTICE_REQUEST', 'NOTICE_ISSUED', 'SEIZURE_REQUEST', 'SEIZURE_PLACED',
    'PAYMENT_RECORDED', 'ADMIN_ACTION', 'CLOSURE', 'OTHER',
  ]),
  stepDescription: z.string().min(1, 'مطلوب').max(2000),
});
type StepForm = z.infer<typeof stepSchema>;

function AddStepModal({
  open, onClose, onSubmit, submitting,
}: { open: boolean; onClose: () => void; submitting: boolean;
     onSubmit: (b: AddExecutionStepRequest) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<StepForm>({
    resolver: zodResolver(stepSchema),
    defaultValues: { stepType: 'ADMIN_ACTION' as ExecutionStepType },
  });
  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="إضافة خطوة تنفيذية"
      footer={
        <>
          <Button type="submit" form="add-step-form" disabled={submitting}>
            {submitting ? <Spinner /> : null}<span>إضافة</span>
          </Button>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>إلغاء</Button>
        </>
      }
    >
      <form id="add-step-form" className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">تاريخ الخطوة</label>
          <Input type="date" {...register('stepDate')} />
          {errors.stepDate && <p className="mt-1 text-xs text-red-600">{errors.stepDate.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">نوع الخطوة</label>
          <Select {...register('stepType')}>
            {(['NOTICE_REQUEST','NOTICE_ISSUED','SEIZURE_REQUEST','SEIZURE_PLACED',
               'PAYMENT_RECORDED','ADMIN_ACTION','CLOSURE','OTHER'] as ExecutionStepType[]).map((t) => (
              <option key={t} value={t}>{EXECUTION_STEP_TYPE_LABEL_AR[t]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">الوصف</label>
          <Textarea rows={3} {...register('stepDescription')} />
          {errors.stepDescription && <p className="mt-1 text-xs text-red-600">{errors.stepDescription.message}</p>}
        </div>
      </form>
    </Modal>
  );
}

