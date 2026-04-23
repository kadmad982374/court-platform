// UI sub-phase B — DelegationsSection.
// Add a new delegated permission (upsert by code) + toggle granted on existing rows.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  DELEGATED_PERMISSION_CODES,
  DELEGATED_PERMISSION_LABEL_AR,
  type DelegatedPermission,
  type DelegatedPermissionCode,
} from '@/shared/types/domain';

import {
  useAddDelegated,
  usePatchDelegated,
} from '../hooks/useUsersAdmin';

const schema = z.object({
  code: z.enum(DELEGATED_PERMISSION_CODES as unknown as [DelegatedPermissionCode, ...DelegatedPermissionCode[]]),
  granted: z.boolean().default(true),
});
type Values = z.infer<typeof schema>;

interface Props {
  userId: number;
  delegations: DelegatedPermission[];
}

export function DelegationsSection({ userId, delegations }: Props) {
  const addM = useAddDelegated(userId);
  const [opError, setOpError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: 'CREATE_CASE', granted: true },
  });

  const onAdd = (v: Values) => {
    setOpError(null);
    addM.mutate({ code: v.code, granted: v.granted }, {
      onSuccess: () => reset({ code: 'CREATE_CASE', granted: true }),
      onError:   (e) => setOpError(extractApiErrorMessage(e)),
    });
  };

  return (
    <Card data-testid="admin-delegations-section">
      <CardHeader>
        <CardTitle>الصلاحيات المفوَّضة</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-slate-500">
          الصلاحيات المفوَّضة تنطبق على المستخدمين من نوع <code>ADMIN_CLERK</code>
          أو حيث يقتضي العقد الخلفي ذلك (D-004). إعادة الإرسال بنفس الكود
          تُحدِّث القيمة بدلًا من الإضافة.
        </p>

        {delegations.length === 0 ? (
          <p className="text-sm text-slate-500">لا تفويضات مسجَّلة.</p>
        ) : (
          <Table data-testid="admin-delegations-table">
            <THead>
              <TR>
                <TH>الصلاحية</TH>
                <TH>الحالة</TH>
                <TH>إجراء</TH>
              </TR>
            </THead>
            <TBody>
              {delegations.map((p) => (
                <DelegationRow key={p.id} userId={userId} permission={p} />
              ))}
            </TBody>
          </Table>
        )}

        <form
          onSubmit={handleSubmit(onAdd)}
          className="flex flex-wrap items-end gap-2"
          data-testid="admin-delegations-add-form"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">الصلاحية</span>
            <Select aria-label="delegation-code" {...register('code')}>
              {DELEGATED_PERMISSION_CODES.map((c) => (
                <option key={c} value={c}>{DELEGATED_PERMISSION_LABEL_AR[c]}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked {...register('granted')} />
            <span>ممنوحة</span>
          </label>
          <Button type="submit" disabled={isSubmitting || addM.isPending}>
            {addM.isPending ? <Spinner /> : null}
            <span>إضافة/تحديث</span>
          </Button>
          {errors.code && <p className="text-sm text-red-600">{errors.code.message}</p>}
        </form>

        {opError && (
          <p
            role="alert"
            className="text-sm text-red-600"
            data-testid="admin-delegations-error"
          >
            {opError}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function DelegationRow({
  userId, permission,
}: { userId: number; permission: DelegatedPermission }) {
  const patchM = usePatchDelegated(userId, permission.id);
  const [err, setErr] = useState<string | null>(null);
  const toggle = () => {
    setErr(null);
    patchM.mutate(
      { granted: !permission.granted },
      { onError: (e) => setErr(extractApiErrorMessage(e)) },
    );
  };
  return (
    <TR>
      <TD>{DELEGATED_PERMISSION_LABEL_AR[permission.code]}</TD>
      <TD>{permission.granted ? 'ممنوحة' : 'محجوبة'}</TD>
      <TD>
        <button
          type="button"
          className="text-xs text-brand-700 hover:underline"
          aria-label={`toggle-${permission.code}`}
          disabled={patchM.isPending}
          onClick={toggle}
        >
          {permission.granted ? 'حجب' : 'منح'}
        </button>
        {err && <span className="block text-xs text-red-600" role="alert">{err}</span>}
      </TD>
    </TR>
  );
}

