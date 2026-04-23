// Phase 11 — CreateCasePage.
//
// Backend contract: POST /api/v1/cases (existing). Body = CreateCaseRequest.
// Backend gate: SECTION_HEAD of (branchId, departmentId), OR ADMIN_CLERK with
// delegated CREATE_CASE.
//
// UX rules:
//   - Branches dropdown: limited to the user's own active SECTION_HEAD/ADMIN_CLERK
//     memberships (the ONLY (branch, dept) pairs the backend will accept). This
//     avoids showing options that will be rejected on submit.
//   - Departments dropdown: limited to the user's memberships in the chosen branch.
//   - Courts dropdown: filtered by branchId + the chosen department's TYPE so we
//     never offer a court that fails `OrganizationService.validateConsistency`.
//   - Postponement reason in this phase: free text (D-020). The "managed list"
//     (postponement_reasons reference table) is consumed by the rollover/finalize
//     flow only; the create-case payload still uses a free-text VARCHAR per D-020.
//     This is documented as gap "Phase 11 / lookups" — backend acceptance is
//     unaffected because the column is free text at this layer.
//   - Free-text fields trimmed; numeric coercion via zod.
//   - Errors from backend bubbled via extractApiErrorMessage.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createCase } from './api';
import { useAuth } from '@/features/auth/AuthContext';
import { canCreateCase } from '@/features/auth/permissions';
import { listBranches, listDepartments, listCourts } from '@/shared/api/lookups';
import { Button } from '@/shared/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Select, Textarea } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  PUBLIC_ENTITY_POSITION_LABEL_AR,
  STAGE_TYPE_LABEL_AR,
  type CreateCaseRequest,
  type DepartmentType,
  type PublicEntityPosition,
  type StageType,
} from '@/shared/types/domain';

const schema = z.object({
  branchId:                z.coerce.number().int().positive('اختر الفرع'),
  departmentId:            z.coerce.number().int().positive('اختر القسم'),
  courtId:                 z.coerce.number().int().positive('اختر المحكمة'),
  chamberName:             z.string().trim().max(128).optional().or(z.literal('')),
  publicEntityName:        z.string().trim().min(1, 'مطلوب').max(200),
  publicEntityPosition:    z.enum(['PLAINTIFF', 'DEFENDANT']),
  opponentName:            z.string().trim().min(1, 'مطلوب').max(200),
  originalBasisNumber:     z.string().trim().min(1, 'مطلوب').max(64),
  basisYear:               z.coerce.number().int().min(1900).max(2100),
  originalRegistrationDate: z.string().min(1, 'مطلوب'),       // yyyy-MM-dd
  stageType:               z.enum(['CONCILIATION', 'FIRST_INSTANCE', 'APPEAL']),
  stageBasisNumber:        z.string().trim().min(1, 'مطلوب').max(64),
  stageYear:               z.coerce.number().int().min(1900).max(2100),
  firstHearingDate:        z.string().min(1, 'مطلوب'),       // yyyy-MM-dd
  firstPostponementReason: z.string().trim().min(1, 'مطلوب').max(200),
});
type FormValues = z.infer<typeof schema>;

const POSITION_OPTIONS: PublicEntityPosition[] = ['PLAINTIFF', 'DEFENDANT'];
const STAGE_OPTIONS: StageType[] = ['CONCILIATION', 'FIRST_INSTANCE', 'APPEAL'];

/** Map StageType → DepartmentType for the courts filter. */
const STAGE_TO_DEPT_TYPE: Record<StageType, DepartmentType> = {
  CONCILIATION:   'CONCILIATION',
  FIRST_INSTANCE: 'FIRST_INSTANCE',
  APPEAL:         'APPEAL',
};

export function CreateCasePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const allowed = canCreateCase(user);

  const branchesQ = useQuery({ queryKey: ['lookup', 'branches'], queryFn: listBranches, enabled: allowed });

  const allowedBranchIds = useMemo(() => {
    if (!user) return new Set<number>();
    return new Set(
      user.departmentMemberships
        .filter((m) => m.active && (m.membershipType === 'SECTION_HEAD' || m.membershipType === 'ADMIN_CLERK'))
        .map((m) => m.branchId),
    );
  }, [user]);

  const visibleBranches = useMemo(
    () => (branchesQ.data ?? []).filter((b) => b.active && allowedBranchIds.has(b.id)),
    [branchesQ.data, allowedBranchIds],
  );

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      publicEntityPosition: 'DEFENDANT',
      stageType: 'FIRST_INSTANCE',
    },
  });

  const branchId  = watch('branchId');
  const stageType = watch('stageType');

  const departmentsQ = useQuery({
    queryKey: ['lookup', 'departments', branchId],
    queryFn: () => listDepartments(Number(branchId)),
    enabled: allowed && !!branchId,
  });

  const allowedDeptIds = useMemo(() => {
    if (!user || !branchId) return new Set<number>();
    return new Set(
      user.departmentMemberships
        .filter(
          (m) =>
            m.active &&
            m.branchId === Number(branchId) &&
            (m.membershipType === 'SECTION_HEAD' || m.membershipType === 'ADMIN_CLERK') &&
            m.departmentId != null,
        )
        .map((m) => m.departmentId as number),
    );
  }, [user, branchId]);

  const visibleDepartments = useMemo(
    () => (departmentsQ.data ?? []).filter((d) => d.active && allowedDeptIds.has(d.id)),
    [departmentsQ.data, allowedDeptIds],
  );

  const departmentTypeForCourts: DepartmentType = STAGE_TO_DEPT_TYPE[stageType ?? 'FIRST_INSTANCE'];

  const courtsQ = useQuery({
    queryKey: ['lookup', 'courts', branchId, departmentTypeForCourts],
    queryFn: () => listCourts({ branchId: Number(branchId), departmentType: departmentTypeForCourts }),
    enabled: allowed && !!branchId,
  });

  // Reset court when branch / stage type changes (their valid courts differ).
  useEffect(() => {
    setValue('courtId', 0 as unknown as number);
  }, [branchId, departmentTypeForCourts, setValue]);

  // Reset department when branch changes.
  useEffect(() => {
    setValue('departmentId', 0 as unknown as number);
  }, [branchId, setValue]);

  const createMut = useMutation({
    mutationFn: (body: CreateCaseRequest) => createCase(body),
    onSuccess: (lc) => {
      reset();
      navigate(`/cases/${lc.id}`);
    },
    onError: (e) => setServerError(extractApiErrorMessage(e)),
  });

  if (!allowed) {
    return (
      <>
        <PageHeader title="إنشاء دعوى" />
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600">
              لا تملك صلاحية إنشاء دعوى. هذا الإجراء متاح لرؤساء الأقسام، أو الموظف الإداري المُفوَّض
              بصلاحية <code>CREATE_CASE</code> (D-004).
            </p>
          </CardBody>
        </Card>
      </>
    );
  }

  const onSubmit = (v: FormValues) => {
    setServerError(null);
    const body: CreateCaseRequest = {
      publicEntityName: v.publicEntityName,
      publicEntityPosition: v.publicEntityPosition,
      opponentName: v.opponentName,
      originalBasisNumber: v.originalBasisNumber,
      basisYear: Number(v.basisYear),
      originalRegistrationDate: v.originalRegistrationDate,
      branchId: Number(v.branchId),
      departmentId: Number(v.departmentId),
      courtId: Number(v.courtId),
      chamberName: v.chamberName ? v.chamberName : null,
      stageType: v.stageType,
      stageBasisNumber: v.stageBasisNumber,
      stageYear: Number(v.stageYear),
      firstHearingDate: v.firstHearingDate,
      firstPostponementReason: v.firstPostponementReason,
    };
    createMut.mutate(body);
  };

  return (
    <>
      <PageHeader
        title="إنشاء دعوى"
        subtitle="القيد التأسيسي للدعوى. الفرع/القسم محصور بعضوياتك الفعّالة (الخادم يُلزم القاعدة)."
      />

      {serverError && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-2" noValidate>
        <Card>
          <CardHeader><CardTitle>الموقع التنظيمي</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Field label="الفرع" error={errors.branchId?.message}>
              <Select {...register('branchId')} disabled={branchesQ.isLoading}>
                <option value="">— اختر —</option>
                {visibleBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.nameAr}</option>
                ))}
              </Select>
              {visibleBranches.length === 0 && branchesQ.isFetched && (
                <p className="mt-1 text-xs text-amber-600">
                  لا توجد فروع متاحة لك (تحتاج عضوية SECTION_HEAD أو ADMIN_CLERK).
                </p>
              )}
            </Field>

            <Field label="القسم" error={errors.departmentId?.message}>
              <Select {...register('departmentId')} disabled={!branchId || departmentsQ.isLoading}>
                <option value="">— اختر —</option>
                {visibleDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.nameAr}</option>
                ))}
              </Select>
            </Field>

            <Field label="نوع المرحلة" error={errors.stageType?.message}>
              <Select {...register('stageType')}>
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STAGE_TYPE_LABEL_AR[s]}</option>
                ))}
              </Select>
            </Field>

            <Field label="المحكمة" error={errors.courtId?.message}>
              <Select {...register('courtId')} disabled={!branchId || courtsQ.isLoading}>
                <option value="">— اختر —</option>
                {(courtsQ.data ?? []).filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{c.nameAr}</option>
                ))}
              </Select>
            </Field>

            <Field label="اسم الدائرة (اختياري)" error={errors.chamberName?.message}>
              <Input {...register('chamberName')} placeholder="إن وُجد" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>أطراف الدعوى</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Field label="اسم الجهة العامة" error={errors.publicEntityName?.message}>
              <Input {...register('publicEntityName')} />
            </Field>
            <Field label="صفة الجهة" error={errors.publicEntityPosition?.message}>
              <Select {...register('publicEntityPosition')}>
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PUBLIC_ENTITY_POSITION_LABEL_AR[p]}</option>
                ))}
              </Select>
            </Field>
            <Field label="اسم الخصم" error={errors.opponentName?.message}>
              <Input {...register('opponentName')} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>الأساس الأصلي</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Field label="رقم الأساس الأصلي" error={errors.originalBasisNumber?.message}>
              <Input {...register('originalBasisNumber')} />
            </Field>
            <Field label="سنة الأساس الأصلي" error={errors.basisYear?.message}>
              <Input type="number" {...register('basisYear')} />
            </Field>
            <Field label="تاريخ القيد الأصلي" error={errors.originalRegistrationDate?.message}>
              <Input type="date" {...register('originalRegistrationDate')} />
              <p className="mt-1 text-xs text-slate-500">D-006: ثابت لا يُعدَّل بعد الإنشاء.</p>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>أساس المرحلة + الجلسة الأولى</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Field label="رقم أساس المرحلة" error={errors.stageBasisNumber?.message}>
              <Input {...register('stageBasisNumber')} />
            </Field>
            <Field label="سنة المرحلة" error={errors.stageYear?.message}>
              <Input type="number" {...register('stageYear')} />
            </Field>
            <Field label="تاريخ الجلسة الأولى" error={errors.firstHearingDate?.message}>
              <Input type="date" {...register('firstHearingDate')} />
            </Field>
            <Field label="سبب التأجيل الأول" error={errors.firstPostponementReason?.message}>
              <Textarea rows={2} {...register('firstPostponementReason')} />
              <p className="mt-1 text-xs text-slate-500">
                نص حر في هذه المرحلة (D-020). القائمة المعيارية متاحة لاحقًا في الترحيل/الفصل فقط.
              </p>
            </Field>
          </CardBody>
        </Card>

        <div className="lg:col-span-2 flex gap-2">
          <Button type="submit" disabled={isSubmitting || createMut.isPending}>
            {createMut.isPending ? <Spinner /> : null}
            <span>قيد الدعوى</span>
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/cases')}>إلغاء</Button>
        </div>
      </form>
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

