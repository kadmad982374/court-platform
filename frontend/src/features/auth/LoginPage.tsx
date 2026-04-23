import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuth } from './AuthContext';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Spinner } from '@/shared/ui/Spinner';
import type { ApiErrorBody } from '@/shared/types/domain';

const schema = z.object({
  username: z.string().min(1, 'الرجاء إدخال اسم المستخدم'),
  password: z.string().min(1, 'الرجاء إدخال كلمة المرور'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string; resetOk?: boolean } };
  const [serverError, setServerError] = useState<string | null>(null);
  const resetOk = !!location.state?.resetOk;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onSubmit' });

  if (status === 'authenticated') {
    return <Navigate to={location.state?.from ?? '/dashboard'} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.username, values.password);
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (e) {
      const err = e as AxiosError<ApiErrorBody>;
      const code = err.response?.data?.code;
      if (err.response?.status === 401 || code === 'INVALID_CREDENTIALS') {
        setServerError('بيانات الدخول غير صحيحة');
      } else if (err.response?.status === 423 || code === 'ACCOUNT_LOCKED') {
        setServerError('الحساب مقفل مؤقتًا — حاول لاحقًا');
      } else {
        setServerError(err.response?.data?.message ?? 'تعذّر تسجيل الدخول');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>تسجيل الدخول</CardTitle>
          <p className="mt-1 text-xs text-slate-500">إدارة قضايا الدولة</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
                اسم المستخدم
              </label>
              <Input id="username" autoComplete="username" {...register('username')} />
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                كلمة المرور
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div
                role="alert"
                className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {serverError}
              </div>
            )}

            {resetOk && !serverError && (
              <div role="status" className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                تم تغيير كلمة المرور بنجاح — يمكنك الدخول الآن.
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Spinner /> : null}
              <span>دخول</span>
            </Button>

            <div className="text-center text-xs text-slate-500">
              <Link to="/forgot-password" className="text-brand-700 hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
