// Phase 11 — ForgotPasswordPage (public).
//
// Backend contract: POST /api/v1/auth/forgot-password { mobileNumber }.
// Per D-013 backend always returns 200 (no enumeration). We keep that promise
// in UI by always showing the same neutral confirmation.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { forgotPassword } from './api';
import { Button } from '@/shared/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

const schema = z.object({
  mobileNumber: z.string().trim().min(6, 'رقم الجوال غير صالح').max(32),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormValues) => {
    setServerError(null);
    try {
      await forgotPassword({ mobileNumber: v.mobileNumber.trim() });
      // D-013 — neutral message regardless of whether the number exists.
      setDone(v.mobileNumber.trim());
    } catch (e) {
      // Server-side throttling or 5xx may surface; OTP existence is never leaked.
      setServerError(extractApiErrorMessage(e));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>استعادة كلمة المرور</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            أدخل رقم جوالك المسجَّل وسنرسل رمز التحقق (OTP) في حال وجوده.
          </p>
        </CardHeader>
        <CardBody>
          {done ? (
            <div className="space-y-3">
              <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                إن كان الرقم مسجَّلًا، سيصلك رمز التحقق خلال دقائق.
              </div>
              <Button
                className="w-full"
                onClick={() => navigate('/reset-password', { state: { mobileNumber: done } })}
              >
                لديّ الرمز — متابعة
              </Button>
              <div className="text-center text-xs text-slate-500">
                <Link to="/login" className="text-brand-700 hover:underline">العودة إلى تسجيل الدخول</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="mobileNumber" className="mb-1 block text-sm font-medium text-slate-700">
                  رقم الجوال
                </label>
                <Input
                  id="mobileNumber" inputMode="tel" autoComplete="tel"
                  {...register('mobileNumber')}
                />
                {errors.mobileNumber && (
                  <p className="mt-1 text-xs text-red-600">{errors.mobileNumber.message}</p>
                )}
              </div>

              {serverError && (
                <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : null}
                <span>إرسال رمز التحقق</span>
              </Button>

              <div className="text-center text-xs text-slate-500">
                <Link to="/login" className="text-brand-700 hover:underline">العودة إلى تسجيل الدخول</Link>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

