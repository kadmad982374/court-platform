import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ROLE_LABEL_AR } from '@/shared/types/domain';

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <PageHeader title="ملفي الشخصي" subtitle="بيانات الحساب الحالي" />
      <Card>
        <CardHeader>
          <CardTitle>المعلومات الأساسية</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="الاسم الكامل" value={user.fullName} />
            <Field label="اسم المستخدم" value={user.username} />
            <Field label="رقم الجوال" value={user.mobileNumber} />
            <Field label="الحالة" value={user.active ? 'نشط' : 'موقوف'} />
            <Field
              label="الأدوار"
              value={user.roles.map((r) => ROLE_LABEL_AR[r]).join('، ') || '—'}
            />
            <Field
              label="عضويات الأقسام"
              value={
                user.departmentMemberships.length === 0
                  ? '—'
                  : `${user.departmentMemberships.length} عضوية`
              }
            />
          </dl>
        </CardBody>
      </Card>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}

