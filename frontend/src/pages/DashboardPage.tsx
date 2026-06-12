import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { CaseSummaryWidget } from '@/features/reports/CaseSummaryWidget';
import { ProfileCard } from '@/features/profile/ProfilePage';

export function DashboardPage() {
  return (
    <>
      <PageHeader
        title="مرحبًا"
        subtitle="نظرة سريعة على دعاويك ضمن نطاقك."
      />

      {/* PR-13 (customer feedback A-2 / Q-B): pie + money totals on the home
          page. Backend scopes the numbers to the actor's read scope. */}
      <div className="mb-4">
        <CaseSummaryWidget />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Client feedback: profile details now live on the home page. */}
        <ProfileCard />

        <Card>
          <CardHeader>
            <CardTitle>المراجع المتاحة</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-1 ps-4 text-sm text-slate-700">
              <li>قسم الدراسات والمنازعات الخارجية</li>
              <li>دليل الجهات العامة</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

