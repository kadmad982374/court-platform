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
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  DECISION_TYPE_LABEL_AR,
  stageSimpleStatus,
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
      void qc.invalidateQueries({ queryKey: ['stages', stageId, 'progression'] });
      void qc.invalidateQueries({ queryKey: ['stages', stageId, 'history'] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  const finalizeMut = useMutation({
    mutationFn: (body: FinalizeReq) => finalizeStage(stageId, body),
    onSuccess: () => {
      setActionError(null); setFinalizeOpen(false);
      void qc.invalidateQueries({ queryKey: ['stages', stageId] });
      void qc.invalidateQueries({ queryKey: ['stages', stageId, 'progression'] });
      void qc.invalidateQueries({ queryKey: ['stages', stageId, 'history'] });
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
        title={stage ? `المرحلة — ${STAGE_TYPE_LABEL_AR[stage.stageType]}` : 'المرحلة'}
        subtitle={stage ? STAGE_STATUS_LABEL_AR[stage.stageStatus] : undefined}
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
            {progQ.isError && (
              <p className="text-sm text-red-600">
                {extractApiErrorMessage(progQ.error, 'تعذّر تحميل التقدم.')}
              </p>
            )}
            {progQ.data && (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Field k="حالة الدعوى" v={stageSimpleStatus(progQ.data.latestStageStatus)} />
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
            <CardTitle>مجريات الجلسة</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
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

            <div className="border-t border-slate-100 pt-3">
              <h4 className="mb-2 text-xs font-medium text-slate-600">الملاحظات</h4>
              {histQ.isLoading && <Spinner className="text-brand-600" />}
              {histQ.data && histQ.data.filter((e) => e.notes && e.notes.trim()).length === 0 && (
                <p className="text-xs text-slate-400">لا توجد ملاحظات.</p>
              )}
              {histQ.data && (
                <ul className="space-y-2">
                  {histQ.data
                    .filter((e) => e.notes && e.notes.trim())
                    .slice()
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((e) => (
                      <li key={e.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                        <p className="text-xs text-slate-500">
                          {e.hearingDate} — {e.postponementReasonLabel ?? '—'}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{e.notes}</p>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

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
  notes:                  z.string().max(2000).optional(),
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
      <form
        id="rollover-form"
        className="space-y-3"
        onSubmit={handleSubmit((v) => onSubmit({
          nextHearingDate: v.nextHearingDate,
          postponementReasonCode: v.postponementReasonCode,
          notes: v.notes && v.notes.trim() ? v.notes.trim() : null,
        }))}
      >
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
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظة (اختياري)</label>
          <Textarea rows={3} {...register('notes')} />
          {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">العملة</label>
            <Select {...register('currencyCode')}>
              <option value="">—</option>
              <option value="SYP">ل.س (SYP)</option>
              <option value="USD">دولار (USD)</option>
              <option value="EUR">يورو (EUR)</option>
            </Select>
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

