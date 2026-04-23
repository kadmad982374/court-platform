// UI sub-phase B — MembershipsSection.
// Add membership (with branch/dept cascade) + patch active/primary.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { listBranches, listDepartments } from '@/shared/api/lookups';
import {
  MEMBERSHIP_TYPES,
  MEMBERSHIP_TYPE_LABEL_AR,
  type DepartmentMembership,
  type MembershipType,
} from '@/shared/types/domain';

import {
  useAddMembership,
  usePatchMembership,
} from '../hooks/useUsersAdmin';

const schema = z.object({
  branchId:       z.coerce.number().int().positive('اختر الفرع'),
  membershipType: z.enum(MEMBERSHIP_TYPES as unknown as [MembershipType, ...MembershipType[]]),
  departmentId:   z.coerce.number().int().positive().nullable().optional(),
  primary:        z.boolean().default(false),
  active:         z.boolean().default(true),
}).superRefine((v, ctx) => {
  if (v.membershipType === 'BRANCH_HEAD') {
    if (v.departmentId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['departmentId'],
        message: 'يجب ترك القسم فارغًا لعضوية رئيس فرع',
      });
    }
  } else if (!v.departmentId || v.departmentId <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['departmentId'], message: 'اختر القسم',
    });
  }
});
type Values = z.infer<typeof schema>;

interface Props {
  userId: number;
  memberships: DepartmentMembership[];
}

export function MembershipsSection({ userId, memberships }: Props) {
  const branchesQ = useQuery({ queryKey: ['lookup', 'branches'], queryFn: listBranches });

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { membershipType: 'STATE_LAWYER', primary: false, active: true },
  });

  const branchId = watch('branchId');
  const membershipType = watch('membershipType');
  const isBranchHeadType = membershipType === 'BRANCH_HEAD';

  // When BRANCH_HEAD type chosen → force departmentId = null.
  useEffect(() => {
    if (isBranchHeadType) setValue('departmentId', null);
  }, [isBranchHeadType, setValue]);

  // When branch changes → clear department.
  useEffect(() => {
    if (!isBranchHeadType) setValue('departmentId', null);
  }, [branchId, isBranchHeadType, setValue]);

  const departmentsQ = useQuery({
    queryKey: ['lookup', 'departments', branchId],
    queryFn: () => listDepartments(Number(branchId)),
    enabled: !!branchId && !isBranchHeadType,
  });

  const visibleBranches = useMemo(
    () => (branchesQ.data ?? []).filter((b) => b.active),
    [branchesQ.data],
  );
  const visibleDepartments = useMemo(
    () => (departmentsQ.data ?? []).filter((d) => d.active),
    [departmentsQ.data],
  );

  const addM = useAddMembership(userId);
  const [opError, setOpError] = useState<string | null>(null);

  const onAdd = (v: Values) => {
    setOpError(null);
    addM.mutate(
      {
        branchId: Number(v.branchId),
        departmentId: isBranchHeadType ? null : Number(v.departmentId),
        membershipType: v.membershipType,
        primary: !!v.primary,
        active:  v.active !== false,
      },
      {
        onSuccess: () => reset({
          membershipType: 'STATE_LAWYER', primary: false, active: true,
        }),
        onError: (e) => setOpError(extractApiErrorMessage(e)),
      },
    );
  };

  return (
    <Card data-testid="admin-memberships-section">
      <CardHeader>
        <CardTitle>العضويات</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {memberships.length === 0 ? (
          <p className="text-sm text-slate-500">لا عضويات.</p>
        ) : (
          <Table data-testid="admin-memberships-table">
            <THead>
              <TR>
                <TH>الفرع</TH>
                <TH>القسم</TH>
                <TH>النوع</TH>
                <TH>أساسية</TH>
                <TH>نشطة</TH>
                <TH>إجراء</TH>
              </TR>
            </THead>
            <TBody>
              {memberships.map((m) => (
                <MembershipRow key={m.id} userId={userId} membership={m} />
              ))}
            </TBody>
          </Table>
        )}

        <form
          onSubmit={handleSubmit(onAdd)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
          data-testid="admin-memberships-add-form"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">النوع</span>
            <Select aria-label="membership-type" {...register('membershipType')}>
              {MEMBERSHIP_TYPES.map((t) => (
                <option key={t} value={t}>{MEMBERSHIP_TYPE_LABEL_AR[t]}</option>
              ))}
            </Select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">الفرع</span>
            <Select aria-label="membership-branch" {...register('branchId')}>
              <option value="">— اختر —</option>
              {visibleBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.nameAr}</option>
              ))}
            </Select>
            {errors.branchId && (
              <p className="mt-1 text-xs text-red-600">{errors.branchId.message}</p>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">القسم</span>
            <Select
              aria-label="membership-department"
              disabled={isBranchHeadType || !branchId}
              {...register('departmentId')}
            >
              <option value="">— اختر —</option>
              {visibleDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.nameAr}</option>
              ))}
            </Select>
            {errors.departmentId && (
              <p className="mt-1 text-xs text-red-600">{errors.departmentId.message}</p>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('primary')} />
            <span>أساسية</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked {...register('active')} />
            <span>نشطة</span>
          </label>
          <div className="sm:col-span-2 md:col-span-3">
            <Button type="submit" disabled={isSubmitting || addM.isPending}>
              {addM.isPending ? <Spinner /> : null}
              <span>إضافة عضوية</span>
            </Button>
            {opError && (
              <p
                role="alert"
                className="mt-2 text-sm text-red-600"
                data-testid="admin-memberships-error"
              >
                {opError}
              </p>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function MembershipRow({
  userId, membership,
}: { userId: number; membership: DepartmentMembership }) {
  const patchM = usePatchMembership(userId, membership.id);
  const [err, setErr] = useState<string | null>(null);
  const togglePrimary = () => {
    setErr(null);
    patchM.mutate(
      { primary: !membership.primary },
      { onError: (e) => setErr(extractApiErrorMessage(e)) },
    );
  };
  const toggleActive = () => {
    setErr(null);
    patchM.mutate(
      { active: !membership.active },
      { onError: (e) => setErr(extractApiErrorMessage(e)) },
    );
  };
  return (
    <TR>
      <TD>#{membership.branchId}</TD>
      <TD>{membership.departmentId == null ? '—' : `#${membership.departmentId}`}</TD>
      <TD>{MEMBERSHIP_TYPE_LABEL_AR[membership.membershipType]}</TD>
      <TD>{membership.primary ? 'نعم' : 'لا'}</TD>
      <TD>{membership.active ? 'نعم' : 'لا'}</TD>
      <TD className="space-x-1 space-x-reverse">
        <button
          type="button"
          className="text-xs text-brand-700 hover:underline"
          aria-label={`toggle-primary-${membership.id}`}
          disabled={patchM.isPending}
          onClick={togglePrimary}
        >
          {membership.primary ? 'إلغاء كأساسية' : 'تعيين كأساسية'}
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="text-xs text-brand-700 hover:underline"
          aria-label={`toggle-active-${membership.id}`}
          disabled={patchM.isPending}
          onClick={toggleActive}
        >
          {membership.active ? 'تعطيل' : 'تفعيل'}
        </button>
        {err && <span className="block text-xs text-red-600" role="alert">{err}</span>}
      </TD>
    </TR>
  );
}

