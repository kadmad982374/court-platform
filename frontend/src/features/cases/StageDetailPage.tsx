import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  finalizeStage,
  getPostponementReasons,
  getStage,
  getStageHistory,
  getStageProgression,
  rolloverHearing,
} from './stagesApi';
import { useAuth } from '@/features/auth/AuthContext';
import { canFinalizeStage, canRolloverHearing, canUploadStageAttachment } from '@/features/auth/permissions';
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
  DECISION_TYPE_LABEL_AR,
  ENTRY_TYPE_LABEL_AR,
  STAGE_STATUS_LABEL_AR,
  STAGE_TYPE_LABEL_AR,
  type DecisionType,
  type FinalizeRequest as FinalizeReq,
  type RolloverHearingRequest as RolloverReq,
} from '@/shared/types/domain';

export function StageDetailPage() {
  const params = useParams<{ stageId: string }>();
  const stageId = Number(params.stageId);
  const qc = useQueryClient();
  const { user } = useAuth();

  const stageQ = useQuery({
    queryKey: ['stages', stageId],
    queryFn: () => getStage(stageId),
    enabled: Number.isFinite(stageId),
  });
  const progQ = useQuery({
    queryKey: ['stages', stageId, 'progression'],
    queryFn: () => getStageProgression(stageId),
    enabled: Number.isFinite(stageId),
  });
  const histQ = useQuery({
    queryKey: ['stages', stageId, 'history'],
    queryFn: () => getStageHistory(stageId),
    enabled: Number.isFinite(stageId),
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const rolloverMut = useMutation({
    mutationFn: (body: RolloverReq) => rolloverHearing(stageId, body),
    onSuccess: () => {
      setActionError(null); setRolloverOpen(false);
      void qc.invalidateQueries({ queryKey: ['stages', stageId] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  const finalizeMut = useMutation({
    mutationFn: (body: FinalizeReq) => finalizeStage(stageId, body),
    onSuccess: () => {
      setActionError(null); setFinalizeOpen(false);
      void qc.invalidateQueries({ queryKey: ['stages', stageId] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  if (!Number.isFinite(stageId)) return <p className="text-sm text-red-600">معرّف غير صالح.</p>;

  const stage = stageQ.data;
  const showRollover = canRolloverHearing(user, stage ?? null);
  const showFinalize = canFinalizeStage(user, stage ?? null);

  return (
    <>
      <PageHeader
        title={`المرحلة #${stageId}`}
        subtitle={
          stage
            ? `${STAGE_TYPE_LABEL_AR[stage.stageType]} — ${STAGE_STATUS_LABEL_AR[stage.stageStatus]}`
            : undefined
        }
      />

      {actionError && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>وضع الجلسة الحالية</CardTitle>
          </CardHeader>
          <CardBody>
            {progQ.isLoading && <Spinner className="text-brand-600" />}
            {progQ.isError && <p className="text-sm text-red-600">تعذّر تحميل التقدم.</p>}
            {progQ.data && (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Field k="حالة المرحلة" v={STAGE_STATUS_LABEL_AR[progQ.data.latestStageStatus]} />
                <Field k="جلسة سابقة"  v={progQ.data.previousHearingDate ?? '—'} />
                <Field k="سبب التأجيل السابق" v={progQ.data.previousPostponementReasonLabel ?? '—'} />
                <Field k="جلسة حالية"  v={progQ.data.currentHearingDate ?? '—'} />
                <Field k="سبب التأجيل الحالي"  v={progQ.data.currentPostponementReasonLabel ?? '—'} />
              </dl>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أفعال المرحلة</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-xs text-slate-500">
              تظهر فقط للمحامي المُسنَد للمرحلة (D-024). يمنع الخادم أي محاولة من غيره.
            </p>
            <div className="flex flex-wrap gap-2">
              {showRollover && (
                <Button onClick={() => setRolloverOpen(true)} variant="secondary">
                  ترحيل الجلسة
                </Button>
              )}
              {showFinalize && (
                <Button onClick={() => setFinalizeOpen(true)}>
                  فصل المرحلة
                </Button>
              )}
              {!showRollover && !showFinalize && (
                <p className="text-xs text-slate-400">لا توجد أفعال متاحة لك على هذه المرحلة.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>سجل الجلسات (append-only — D-022)</CardTitle>
        </CardHeader>
        <CardBody>
          {histQ.isLoading && <Spinner className="text-brand-600" />}
          {histQ.isError && <p className="text-sm text-red-600">تعذّر تحميل السجل.</p>}
          {histQ.data && histQ.data.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد قيود.</p>
          )}
          {histQ.data && histQ.data.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>تاريخ الجلسة</TH>
                  <TH>سبب التأجيل</TH>
                  <TH>نوع القيد</TH>
                  <TH>أُدخل بتاريخ</TH>
                </TR>
              </THead>
              <TBody>
                {histQ.data.map((e) => (
                  <TR key={e.id}>
                    <TD>{e.hearingDate}</TD>
                    <TD>{e.postponementReasonLabel ?? e.postponementReasonCode ?? '—'}</TD>
                    <TD>{ENTRY_TYPE_LABEL_AR[e.entryType]}</TD>
                    <TD className="text-xs text-slate-500">{e.createdAt}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <RolloverModal
        open={rolloverOpen}
        onClose={() => { setRolloverOpen(false); setActionError(null); }}
        submitting={rolloverMut.isPending}
        onSubmit={(b) => rolloverMut.mutate(b)}
      />
      <FinalizeModal
        open={finalizeOpen}
        onClose={() => { setFinalizeOpen(false); setActionError(null); }}
        submitting={finalizeMut.isPending}
        onSubmit={(b) => finalizeMut.mutate(b)}
      />

      {/* Phase 10 — attachments scoped to this stage (D-035 / D-036). */}
      <AttachmentsSection
        scope="STAGE"
        stageId={stageId}
        canUpload={canUploadStageAttachment(user, stage ?? null)}
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

// ---------- Rollover modal ----------

const rolloverSchema = z.object({
  nextHearingDate:        z.string().min(1, 'مطلوب'),
  postponementReasonCode: z.string().min(1, 'مطلوب'),
});
type RolloverForm = z.infer<typeof rolloverSchema>;

function RolloverModal({
  open, onClose, onSubmit, submitting,
}: { open: boolean; onClose: () => void; submitting: boolean;
     onSubmit: (b: RolloverReq) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RolloverForm>({
    resolver: zodResolver(rolloverSchema),
  });

  // قائمة أسباب التأجيل المعيارية (Reference Table — D-008/D-022).
  // تُجلب فقط عند فتح النافذة كي لا نُحمّل الصفحة بطلب إضافي بدون داعٍ.
  const reasonsQ = useQuery({
    queryKey: ['postponement-reasons'],
    queryFn: getPostponementReasons,
    enabled: open,
    staleTime: 5 * 60_000,
  });

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="ترحيل الجلسة"
      footer={
        <>
          <Button type="submit" form="rollover-form" disabled={submitting}>
            {submitting ? <Spinner /> : null}<span>ترحيل</span>
          </Button>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>إلغاء</Button>
        </>
      }
    >
      <form id="rollover-form" className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">تاريخ الجلسة التالية</label>
          <Input type="date" {...register('nextHearingDate')} />
          {errors.nextHearingDate && <p className="mt-1 text-xs text-red-600">{errors.nextHearingDate.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">سبب التأجيل</label>
          <Select
            {...register('postponementReasonCode')}
            disabled={reasonsQ.isLoading || reasonsQ.isError}
            defaultValue=""
          >
            <option value="" disabled>
              {reasonsQ.isLoading ? 'جارٍ التحميل…' : '— اختر سببًا —'}
            </option>
            {reasonsQ.data?.map((r) => (
              <option key={r.code} value={r.code}>{r.labelAr}</option>
            ))}
          </Select>
          {reasonsQ.isError && (
            <p className="mt-1 text-xs text-red-600">تعذّر تحميل قائمة الأسباب.</p>
          )}
          {errors.postponementReasonCode && (
            <p className="mt-1 text-xs text-red-600">{errors.postponementReasonCode.message}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ---------- Finalize modal ----------

const finalizeSchema = z.object({
  decisionNumber: z.string().min(1, 'مطلوب').max(64),
  decisionDate:   z.string().min(1, 'مطلوب'),
  decisionType:   z.enum(['FOR_ENTITY', 'AGAINST_ENTITY', 'SETTLEMENT', 'NON_FINAL']),
  adjudgedAmount: z.string().optional(),
  currencyCode:   z.string().length(3).optional().or(z.literal('')),
  summaryNotes:   z.string().max(4000).optional(),
});
type FinalizeForm = z.infer<typeof finalizeSchema>;

function FinalizeModal({
  open, onClose, onSubmit, submitting,
}: { open: boolean; onClose: () => void; submitting: boolean;
     onSubmit: (b: FinalizeReq) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FinalizeForm>({
    resolver: zodResolver(finalizeSchema),
    defaultValues: { decisionType: 'NON_FINAL' as DecisionType },
  });
  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="فصل المرحلة"
      footer={
        <>
          <Button type="submit" form="finalize-form" disabled={submitting}>
            {submitting ? <Spinner /> : null}<span>فصل</span>
          </Button>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>إلغاء</Button>
        </>
      }
    >
      <form
        id="finalize-form" className="space-y-3"
        onSubmit={handleSubmit((v) => onSubmit({
          decisionNumber: v.decisionNumber,
          decisionDate:   v.decisionDate,
          decisionType:   v.decisionType,
          adjudgedAmount: v.adjudgedAmount ? v.adjudgedAmount : null,
          currencyCode:   v.currencyCode ? v.currencyCode : null,
          summaryNotes:   v.summaryNotes ? v.summaryNotes : null,
        }))}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">رقم القرار</label>
          <Input {...register('decisionNumber')} />
          {errors.decisionNumber && <p className="mt-1 text-xs text-red-600">{errors.decisionNumber.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">تاريخ القرار</label>
          <Input type="date" {...register('decisionDate')} />
          {errors.decisionDate && <p className="mt-1 text-xs text-red-600">{errors.decisionDate.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">نوع القرار</label>
          <Select {...register('decisionType')}>
            {(['FOR_ENTITY', 'AGAINST_ENTITY', 'SETTLEMENT', 'NON_FINAL'] as DecisionType[]).map((t) => (
              <option key={t} value={t}>{DECISION_TYPE_LABEL_AR[t]}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">المبلغ المحكوم به (اختياري)</label>
            <Input type="number" step="0.01" min="0" {...register('adjudgedAmount')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">العملة (3 أحرف)</label>
            <Input maxLength={3} placeholder="SYP" {...register('currencyCode')} />
            {errors.currencyCode && <p className="mt-1 text-xs text-red-600">{errors.currencyCode.message}</p>}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات (اختياري)</label>
          <Textarea rows={3} {...register('summaryNotes')} />
        </div>
      </form>
    </Modal>
  );
}

