// Phase 11 — ResetPasswordPage (public).
//
// Backend contract: POST /api/v1/auth/reset-password { mobileNumber, code, newPassword }.
// On success: D-019 invalidates ALL refresh tokens for the user; we redirect to /login.

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AxiosError } from 'axios';

import { resetPassword } from './api';
import { Button } from '@/shared/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import type { ApiErrorBody } from '@/shared/types/domain';

const schema = z.object({
  mobileNumber:    z.string().trim().min(6, 'رقم الجوال غير صالح').max(32),
  code:            z.string().trim().min(4, 'الرمز غير صالح').max(12),
  newPassword:     z.string().min(8, 'الحد الأدنى 8 محارف').max(100),
  confirmPassword: z.string().min(8),
}).refine((v) => v.newPassword === v.confirmPassword, {
  path: ['confirmPassword'],
  message: 'تأكيد كلمة المرور غير مطابق',
});
type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { mobileNumber?: string } };
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mobileNumber: location.state?.mobileNumber ?? '' },
  });

  const onSubmit = async (v: FormValues) => {
    setServerError(null);
    try {
      await resetPassword({
        mobileNumber: v.mobileNumber.trim(),
        code: v.code.trim(),
        newPassword: v.newPassword,
      });
      navigate('/login', { replace: true, state: { resetOk: true } });
    } catch (e) {
      const err = e as AxiosError<ApiErrorBody>;
      const code = err.response?.data?.code;
      if (code === 'INVALID_OTP' || err.response?.status === 400) {
        setServerError('رمز غير صحيح أو منتهي الصلاحية.');
      } else if (code === 'OTP_EXPIRED') {
        setServerError('انتهت صلاحية الرمز — اطلب رمزًا جديدًا.');
      } else {
        setServerError(err.response?.data?.message ?? 'تعذّر إعادة تعيين كلمة المرور.');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>إعادة تعيين كلمة المرور</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            أدخل رمز التحقق الذي وصلك على جوالك، ثم اختر كلمة مرور جديدة.
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">رقم الجوال</label>
              <Input inputMode="tel" autoComplete="tel" {...register('mobileNumber')} />
              {errors.mobileNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.mobileNumber.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">رمز التحقق (OTP)</label>
              <Input inputMode="numeric" autoComplete="one-time-code" {...register('code')} />
              {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">كلمة المرور الجديدة</label>
              <Input type="password" autoComplete="new-password" {...register('newPassword')} />
              {errors.newPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">تأكيد كلمة المرور</label>
              <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {serverError && (
              <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              <span>إعادة التعيين</span>
            </Button>

            <div className="text-center text-xs text-slate-500">
              <Link to="/login" className="text-brand-700 hover:underline">العودة إلى تسجيل الدخول</Link>
              {' · '}
              <Link to="/forgot-password" className="text-brand-700 hover:underline">طلب رمز جديد</Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

