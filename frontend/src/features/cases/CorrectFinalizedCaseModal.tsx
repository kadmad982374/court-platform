// PR-11 (customer feedback C-6 / blueprint C-6) —
// Section-head correction of a finalized case.
//
// Per customer Q-D: rights belong to whichever section currently OWNS the case
// (transfers on promotion). Hearing history is never touched.

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { correctFinalizedCase, type CorrectFinalizedCaseRequest } from './api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/FormFields';
import { Modal } from '@/shared/ui/Modal';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  DECISION_TYPE_LABEL_AR,
  type CaseStage,
  type DecisionType,
  type LitigationCase,
} from '@/shared/types/domain';

const schema = z.object({
  originalBasisNumber: z.string().min(1).max(64).optional().or(z.literal('')),
  basisYear:           z.coerce.number().int().min(1900).max(2100).optional(),
  decisionNumber:      z.string().min(1).max(64).optional().or(z.literal('')),
  decisionDate:        z.string().optional().or(z.literal('')),
  decisionType:        z.enum(['FOR_ENTITY', 'AGAINST_ENTITY', 'SETTLEMENT', 'NON_FINAL']).optional(),
});
type FormShape = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  litigationCase: LitigationCase;
  currentStage: CaseStage;
}

export function CorrectFinalizedCaseModal({ open, onClose, litigationCase, currentStage }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormShape>({
    resolver: zodResolver(schema),
  });

  // Pre-fill from the case + stage when the modal opens.
  useEffect(() => {
    if (open) {
      reset({
        originalBasisNumber: litigationCase.originalBasisNumber,
        basisYear:           litigationCase.basisYear,
        decisionNumber:      undefined, // filled in by user — server's existing value not in the LitigationCase DTO
        decisionDate:        undefined,
        decisionType:        undefined,
      });
    }
  }, [open, litigationCase, reset]);

  const mut = useMutation({
    mutationFn: (body: CorrectFinalizedCaseRequest) =>
      correctFinalizedCase(litigationCase.id, body),
    onSuccess: () => {
      onClose();
      void qc.invalidateQueries({ queryKey: ['cases', litigationCase.id] });
      void qc.invalidateQueries({ queryKey: ['cases', litigationCase.id, 'stages'] });
      void qc.invalidateQueries({ queryKey: ['resolved-register'] });
    },
  });

  const submit = handleSubmit((v) => {
    // Strip empty strings so the backend treats them as "unchanged".
    const body: CorrectFinalizedCaseRequest = {};
    if (v.originalBasisNumber && v.originalBasisNumber !== litigationCase.originalBasisNumber) {
      body.originalBasisNumber = v.originalBasisNumber;
    }
    if (v.basisYear != null && v.basisYear !== litigationCase.basisYear) {
      body.basisYear = v.basisYear;
    }
    if (v.decisionNumber)  body.decisionNumber = v.decisionNumber;
    if (v.decisionDate)    body.decisionDate   = v.decisionDate;
    if (v.decisionType)    body.decisionType   = v.decisionType as DecisionType;
    mut.mutate(body);
  });

  const errorMsg = mut.isError ? extractApiErrorMessage(mut.error) : null;

  return (
    <Modal
      open={open}
      onClose={() => { reset(); mut.reset(); onClose(); }}
      title="تصحيح بيانات الدعوى المفصولة"
      footer={
        <>
          <Button type="submit" form="correct-case-form" disabled={mut.isPending}>
            {mut.isPending ? <Spinner /> : null}<span>حفظ التصحيحات</span>
          </Button>
          <Button variant="ghost" onClick={() => { reset(); mut.reset(); onClose(); }}>
            إلغاء
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        الحقول الفارغة تبقى كما هي. سجل الجلسات السابقة لا يُمسّ — تظل المراحل
        السابقة كما هي. فور ترقية الدعوى إلى قسم آخر تنتقل صلاحية التصحيح إلى
        رئيس ذلك القسم.
      </p>

      {errorMsg && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form id="correct-case-form" className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="رقم الأساس" error={errors.originalBasisNumber?.message}>
            <Input {...register('originalBasisNumber')} />
          </FormField>
          <FormField label="سنة الأساس" error={errors.basisYear?.message}>
            <Input type="number" {...register('basisYear')} />
          </FormField>
        </div>
        <hr className="my-2 border-slate-200" />
        <p className="text-xs font-medium text-slate-700">بيانات القرار (املأ ما تريد تصحيحه فقط)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="رقم القرار الجديد" error={errors.decisionNumber?.message}>
            <Input {...register('decisionNumber')} placeholder="اتركه فارغًا للإبقاء" />
          </FormField>
          <FormField label="تاريخ القرار الجديد" error={errors.decisionDate?.message}>
            <Input type="date" {...register('decisionDate')} />
          </FormField>
          <FormField label="نوع القرار الجديد" error={errors.decisionType?.message}>
            <Select {...register('decisionType')}>
              <option value="">— لا تغيير —</option>
              {(['FOR_ENTITY', 'AGAINST_ENTITY', 'SETTLEMENT', 'NON_FINAL'] as DecisionType[]).map((t) => (
                <option key={t} value={t}>{DECISION_TYPE_LABEL_AR[t]}</option>
              ))}
            </Select>
          </FormField>
        </div>
        <p className="text-xs text-slate-400">
          القسم: #{currentStage.branchId} / #{currentStage.departmentId} —
          المرحلة #{currentStage.id}
        </p>
      </form>
    </Modal>
  );
}

function FormField({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
