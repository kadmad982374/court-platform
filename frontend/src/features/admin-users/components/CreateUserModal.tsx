// UI sub-phase B — CreateUserModal.
// Posts to backend `POST /api/v1/users` per D-047 policy:
//   - admin types the initial password
//   - backend rejects the seed literal "ChangeMe!2026" and any < 8 chars
//   - hand-off is out-of-band; no email/SMS in this phase

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

import { useCreateUser } from '../hooks/useUsersAdmin';

const schema = z.object({
  username:        z.string().trim().min(3, 'الحد الأدنى 3').max(64),
  fullName:        z.string().trim().min(2, 'مطلوب').max(200),
  mobileNumber:    z.string().regex(/^09\d{8}$/, 'الصيغة: 09XXXXXXXX'),
  initialPassword: z.string()
    .min(8, 'لا يقل عن 8 أحرف')
    .max(100)
    .refine((v) => v !== 'ChangeMe!2026', 'كلمة مرور افتراضية محظورة'),
  active: z.boolean().default(true),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateUserModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const createM = useCreateUser();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { active: true },
  });

  const onSubmit = (v: Values) => {
    setServerError(null);
    createM.mutate(
      {
        username: v.username,
        fullName: v.fullName,
        mobileNumber: v.mobileNumber,
        initialPassword: v.initialPassword,
        active: v.active,
      },
      {
        onSuccess: ({ id }) => {
          reset();
          onClose();
          navigate(`/admin/users/${id}`);
        },
        onError: (e) => setServerError(extractApiErrorMessage(e)),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إنشاء مستخدم جديد"
      footer={
        <>
          <Button
            type="submit"
            form="admin-user-form"
            disabled={isSubmitting || createM.isPending}
            data-testid="admin-user-save"
          >
            {createM.isPending ? <Spinner /> : null}
            <span>إنشاء</span>
          </Button>
          <Button variant="ghost" onClick={onClose} type="button">إلغاء</Button>
        </>
      }
    >
      <form
        id="admin-user-form"
        data-testid="admin-user-form"
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Field label="اسم المستخدم" error={errors.username?.message}>
          <Input autoComplete="off" {...register('username')} />
        </Field>
        <Field label="الاسم الكامل" error={errors.fullName?.message}>
          <Input {...register('fullName')} />
        </Field>
        <Field label="رقم الموبايل" error={errors.mobileNumber?.message}>
          <Input dir="ltr" placeholder="09XXXXXXXX" {...register('mobileNumber')} />
        </Field>
        <Field label="كلمة المرور الأولية" error={errors.initialPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('initialPassword')} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" defaultChecked {...register('active')} />
          <span>الحساب نشط</span>
        </label>
        <p className="text-xs text-slate-500 sm:col-span-2">
          سياسة كلمة المرور الأولية (D-047): يقدّمها المسؤول هنا، ويسلِّمها
          للمستخدم خارج النطاق التقني. لا يوجد بريد/SMS تلقائي في هذه المرحلة.
          يمكن للمستخدم تغييرها لاحقًا عبر مسار «نسيت كلمة المرور».
        </p>
        {serverError && (
          <p
            role="alert"
            className="text-sm text-red-600 sm:col-span-2"
            data-testid="admin-user-create-error"
          >
            {serverError}
          </p>
        )}
      </form>
    </Modal>
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

