// UI sub-phase B — RolesSection.
// Lists current roles + supports add (D-048 guard) + remove.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { ALL_ROLES, ROLE_LABEL_AR, type RoleCode } from '@/shared/types/domain';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

import { useAddRole, useRemoveRole } from '../hooks/useUsersAdmin';

const schema = z.object({
  role: z.enum(ALL_ROLES as unknown as [RoleCode, ...RoleCode[]]),
});
type Values = z.infer<typeof schema>;

interface Props {
  userId: number;
  roles: RoleCode[];
}

export function RolesSection({ userId, roles }: Props) {
  const addM = useAddRole(userId);
  const remM = useRemoveRole(userId);
  const [opError, setOpError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'STATE_LAWYER' },
  });

  const onAdd = (v: Values) => {
    setOpError(null);
    addM.mutate(v.role, {
      onSuccess: () => reset({ role: 'STATE_LAWYER' }),
      onError:   (e) => setOpError(extractApiErrorMessage(e)),
    });
  };

  const onRemove = (role: RoleCode) => {
    setOpError(null);
    remM.mutate(role, { onError: (e) => setOpError(extractApiErrorMessage(e)) });
  };

  return (
    <Card data-testid="admin-roles-section">
      <CardHeader>
        <CardTitle>الأدوار</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs text-slate-500">
          منح/سحب دور <code>BRANCH_HEAD</code> مقتصر على المشرف المركزي
          (D-048). الخادم هو السلطة النهائية.
        </p>

        {roles.length === 0 ? (
          <p className="text-sm text-slate-500">لا أدوار مُسنَدة.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="admin-roles-list">
            {roles.map((r) => (
              <li
                key={r}
                className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
              >
                <span>{ROLE_LABEL_AR[r]}</span>
                <button
                  type="button"
                  className="text-red-700 hover:underline"
                  aria-label={`remove-${r}`}
                  disabled={remM.isPending}
                  onClick={() => onRemove(r)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={handleSubmit(onAdd)}
          className="flex flex-wrap items-end gap-2"
          data-testid="admin-roles-add-form"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">إضافة دور</span>
            <Select aria-label="role-picker" {...register('role')}>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL_AR[r]}</option>
              ))}
            </Select>
          </label>
          <Button type="submit" disabled={isSubmitting || addM.isPending}>
            {addM.isPending ? <Spinner /> : null}
            <span>إضافة</span>
          </Button>
          {errors.role && <p className="text-sm text-red-600">{errors.role.message}</p>}
        </form>

        {opError && (
          <p role="alert" className="text-sm text-red-600" data-testid="admin-roles-error">
            {opError}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

