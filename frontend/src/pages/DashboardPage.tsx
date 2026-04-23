import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useAuth } from '@/features/auth/AuthContext';
import { ROLE_LABEL_AR } from '@/shared/types/domain';

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        title="مرحبًا"
        subtitle="هذه نسخة الأساس للواجهة (المرحلة 8). صفحات الأعمال ستضاف لاحقًا."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>المستخدم الحالي</CardTitle>
          </CardHeader>
          <CardBody>
            {user ? (
              <ul className="space-y-1 text-sm text-slate-700">
                <li>
                  <span className="text-slate-500">الاسم:</span> {user.fullName}
                </li>
                <li>
                  <span className="text-slate-500">المستخدم:</span> {user.username}
                </li>
                <li>
                  <span className="text-slate-500">الأدوار:</span>{' '}
                  {user.roles.map((r) => ROLE_LABEL_AR[r]).join('، ') || '—'}
                </li>
              </ul>
            ) : (
              <p className="text-sm text-slate-500">لا توجد بيانات.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>المراجع المتاحة</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-1 ps-4 text-sm text-slate-700">
              <li>المكتبة القانونية</li>
              <li>دليل الجهات العامة</li>
              <li>التعاميم</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              صفحات الدعاوى والتنفيذ والمرفقات والتذكيرات والإشعارات ستُبنى في المراحل التالية.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

