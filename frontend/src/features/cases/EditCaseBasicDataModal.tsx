// Phase 11 — EditCaseBasicDataModal.
//
// Backend contract: PUT /api/v1/cases/{id}/basic-data (existing).
// Body = UpdateBasicDataRequest — every field optional; backend applies only what
// is sent. Forbidden by backend: original_registration_date (D-006), ownership,
// stage status. We intentionally do NOT render those.
//
// Backend gate: SECTION_HEAD of (createdBranchId, createdDepartmentId), OR
// ADMIN_CLERK with delegated EDIT_CASE_BASIC_DATA. We hide the entry-point via
// canEditCaseBasicData() in the host page; the modal also assumes the caller
// already gated on it. Backend remains the authority.
//
// To keep the diff minimal we only send fields that actually changed.

import { useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { updateCaseBasicData } from './api';
import { listCourts } from '@/shared/api/lookups';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { Select, Textarea } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  PUBLIC_ENTITY_POSITION_LABEL_AR,
  type DepartmentType,
  type LitigationCase,
  type CaseStage,
  type StageType,
  type UpdateCaseBasicDataRequest,
} from '@/shared/types/domain';

const STAGE_TO_DEPT_TYPE: Record<StageType, DepartmentType> = {
  CONCILIATION:   'CONCILIATION',
  FIRST_INSTANCE: 'FIRST_INSTANCE',
  APPEAL:         'APPEAL',
};

const schema = z.object({
  publicEntityName:        z.string().trim().max(200).optional(),
  publicEntityPosition:    z.enum(['PLAINTIFF', 'DEFENDANT']).optional(),
  opponentName:            z.string().trim().max(200).optional(),
  originalBasisNumber:     z.string().trim().max(64).optional(),
  basisYear:               z.coerce.number().int().min(1900).max(2100).optional()
                              .or(z.literal('').transform(() => undefined)),
  courtId:                 z.coerce.number().int().positive().optional()
                              .or(z.literal('').transform(() => undefined)),
  chamberName:             z.string().trim().max(128).optional(),
  stageBasisNumber:        z.string().trim().max(64).optional(),
  stageYear:               z.coerce.number().int().min(1900).max(2100).optional()
                              .or(z.literal('').transform(() => undefined)),
  firstHearingDate:        z.string().optional(),
  firstPostponementReason: z.string().trim().max(200).optional(),
});
type FormValues = z.infer<typeof schema>;

function diff<T extends object>(initial: T, current: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(current) as (keyof T)[]).forEach((k) => {
    const a = initial[k];
    const b = current[k];
    if (b === undefined || b === '') return;            // skip unchanged blanks
    if (a !== b) out[k] = b;
  });
  return out;
}

interface Props {
  open: boolean;
  onClose: () => void;
  litigationCase: LitigationCase;
  currentStage: CaseStage | null | undefined;
}

export function EditCaseBasicDataModal({ open, onClose, litigationCase, currentStage }: Props) {
  const qc = useQueryClient();

  const initial: FormValues = useMemo(() => ({
    publicEntityName:        litigationCase.publicEntityName,
    publicEntityPosition:    litigationCase.publicEntityPosition,
    opponentName:            litigationCase.opponentName,
    originalBasisNumber:     litigationCase.originalBasisNumber,
    basisYear:               litigationCase.basisYear,
    courtId:                 litigationCase.createdCourtId,
    chamberName:             litigationCase.chamberName ?? '',
    stageBasisNumber:        currentStage?.stageBasisNumber ?? '',
    stageYear:               currentStage?.stageYear,
    firstHearingDate:        currentStage?.firstHearingDate ?? '',
    firstPostponementReason: currentStage?.firstPostponementReason ?? '',
  }), [litigationCase, currentStage]);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  // Reset form whenever the modal opens with fresh data.
  useEffect(() => { if (open) reset(initial); }, [open, initial, reset]);

  // Courts compatible with the case's branch + the current stage's type.
  const stageType: StageType = currentStage?.stageType ?? 'FIRST_INSTANCE';
  const courtsQ = useQuery({
    queryKey: ['lookup', 'courts', litigationCase.createdBranchId, STAGE_TO_DEPT_TYPE[stageType]],
    queryFn: () => listCourts({
      branchId: litigationCase.createdBranchId,
      departmentType: STAGE_TO_DEPT_TYPE[stageType],
    }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: (body: UpdateCaseBasicDataRequest) => updateCaseBasicData(litigationCase.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cases', litigationCase.id] });
      void qc.invalidateQueries({ queryKey: ['cases', litigationCase.id, 'stages'] });
      onClose();
    },
  });

  const onSubmit = (v: FormValues) => {
    const changed = diff(initial, v);
    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }
    mut.mutate(changed as UpdateCaseBasicDataRequest);
  };

  return (
    <Modal
      open={open}
      onClose={() => { mut.reset(); onClose(); }}
      title="تعديل البيانات الأساسية"
      footer={
        <>
          <Button type="submit" form="edit-basic-data-form" disabled={isSubmitting || mut.isPending}>
            {mut.isPending ? <Spinner /> : null}
            <span>حفظ التغييرات</span>
          </Button>
          <Button variant="ghost" onClick={() => { mut.reset(); onClose(); }}>إلغاء</Button>
        </>
      }
    >
      {mut.isError && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {extractApiErrorMessage(mut.error)}
        </div>
      )}

      <form id="edit-basic-data-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate>
        <F label="اسم الجهة العامة" error={errors.publicEntityName?.message}>
          <Input {...register('publicEntityName')} />
        </F>
        <F label="صفة الجهة" error={errors.publicEntityPosition?.message}>
          <Select {...register('publicEntityPosition')}>
            <option value="PLAINTIFF">{PUBLIC_ENTITY_POSITION_LABEL_AR.PLAINTIFF}</option>
            <option value="DEFENDANT">{PUBLIC_ENTITY_POSITION_LABEL_AR.DEFENDANT}</option>
          </Select>
        </F>
        <F label="اسم الخصم" error={errors.opponentName?.message}>
          <Input {...register('opponentName')} />
        </F>
        <F label="رقم الأساس الأصلي" error={errors.originalBasisNumber?.message}>
          <Input {...register('originalBasisNumber')} />
        </F>
        <F label="سنة الأساس الأصلي" error={errors.basisYear?.message}>
          <Input type="number" {...register('basisYear')} />
        </F>

        <F label="المحكمة" error={errors.courtId?.message}>
          <Select {...register('courtId')} disabled={courtsQ.isLoading}>
            <option value="">— بدون تغيير —</option>
            {(courtsQ.data ?? []).filter((c) => c.active).map((c) => (
              <option key={c.id} value={c.id}>{c.nameAr}</option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">يجب أن تبقى المحكمة ضمن نفس الفرع/القسم.</p>
        </F>
        <F label="اسم الدائرة" error={errors.chamberName?.message}>
          <Input {...register('chamberName')} />
        </F>

        <F label="رقم أساس المرحلة" error={errors.stageBasisNumber?.message}>
          <Input {...register('stageBasisNumber')} />
        </F>
        <F label="سنة المرحلة" error={errors.stageYear?.message}>
          <Input type="number" {...register('stageYear')} />
        </F>
        <F label="تاريخ الجلسة الأولى" error={errors.firstHearingDate?.message}>
          <Input type="date" {...register('firstHearingDate')} />
        </F>
        <F label="سبب التأجيل الأول" error={errors.firstPostponementReason?.message}>
          <Textarea rows={2} {...register('firstPostponementReason')} />
        </F>

        <div className="sm:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ممنوع تعديله هنا: تاريخ القيد الأصلي (D-006)، الإسناد، حالة المرحلة. أي محاولة تعديل
          غير مسموحة سيرفضها الخادم بـ 403/400 ويُعرض الخطأ.
        </div>
      </form>
    </Modal>
  );
}

function F({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

