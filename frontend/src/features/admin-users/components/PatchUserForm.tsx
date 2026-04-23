// UI sub-phase B — PatchUserForm.
// Inline editor restricted to the only fields the backend allows on PATCH:
//   active, fullName, mobileNumber.
//
// The component sends a minimal diff (only changed fields).

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

import { usePatchUser } from '../hooks/useUsersAdmin';
import type { UserAdminDto } from '../api/types';

const schema = z.object({
  active:       z.boolean(),
  fullName:     z.string().trim().min(2, 'مطلوب').max(200),
  mobileNumber: z.string().regex(/^09\d{8}$/, 'الصيغة: 09XXXXXXXX'),
});
type Values = z.infer<typeof schema>;

interface Props { user: UserAdminDto; }

export function PatchUserForm({ user }: Props) {
  const patchM = usePatchUser(user.id);
  const [opError, setOpError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      active: user.active,
      fullName: user.fullName,
      mobileNumber: user.mobileNumber,
    },
  });

  const onSubmit = (v: Values) => {
    setOpError(null);
    setOkMsg(null);
    const diff: Record<string, unknown> = {};
    if (v.active !== user.active) diff.active = v.active;
    if (v.fullName.trim() !== user.fullName) diff.fullName = v.fullName.trim();
    if (v.mobileNumber !== user.mobileNumber) diff.mobileNumber = v.mobileNumber;
    if (Object.keys(diff).length === 0) {
      setOkMsg('لا تغييرات لإرسالها.');
      return;
    }
    patchM.mutate(diff, {
      onSuccess: (u) => {
        reset({ active: u.active, fullName: u.fullName, mobileNumber: u.mobileNumber });
        setOkMsg('تم الحفظ.');
      },
      onError: (e) => setOpError(extractApiErrorMessage(e)),
    });
  };

  return (
    <Card data-testid="admin-user-basic-section">
      <CardHeader>
        <CardTitle>البيانات الأساسية</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          data-testid="admin-user-patch-form"
        >
          <ReadOnly label="اسم المستخدم">{user.username}</ReadOnly>
          <ReadOnly label="مُعرِّف">{`#${user.id}`}</ReadOnly>
          <Field label="الاسم الكامل" error={errors.fullName?.message}>
            <Input {...register('fullName')} />
          </Field>
          <Field label="رقم الموبايل" error={errors.mobileNumber?.message}>
            <Input dir="ltr" {...register('mobileNumber')} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register('active')} />
            <span>الحساب نشط</span>
          </label>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting || patchM.isPending}
              data-testid="admin-user-patch-submit"
            >
              {patchM.isPending ? <Spinner /> : null}
              <span>حفظ التغييرات</span>
            </Button>
            {okMsg && (
              <p className="text-sm text-emerald-700" data-testid="admin-user-patch-success">
                {okMsg}
              </p>
            )}
            {opError && (
              <p className="text-sm text-red-600" role="alert" data-testid="admin-user-patch-error">
                {opError}
              </p>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ReadOnly({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="mb-1 block text-slate-700">{label}</span>
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
        {children}
      </div>
    </div>
  );
}

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-700">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

