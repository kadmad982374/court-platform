import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '@/shared/api/http';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import {
  CIRCULAR_SOURCE_LABEL_AR,
  type Circular,
  type PageResponse,
} from '@/shared/types/domain';

/**
 * Phase 8 — minimal read integration only.
 */
export function CircularsPage() {
  const q = useQuery({
    queryKey: ['circulars', { page: 0, size: 20 }],
    queryFn: () => apiGet<PageResponse<Circular>>('/circulars', { page: 0, size: 20 }),
  });

  return (
    <>
      <PageHeader title="التعاميم" subtitle="قائمة مبدئية بأحدث التعاميم." />
      <Card>
        <CardHeader>
          <CardTitle>أحدث التعاميم</CardTitle>
        </CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && <p className="text-sm text-red-600">تعذّر تحميل التعاميم.</p>}
          {q.data && (
            <ul className="divide-y divide-slate-100 text-sm">
              {q.data.content.map((c) => (
                <li key={c.id} className="py-2">
                  <Link
                    to={`/circulars/${c.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {c.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                    <span>{CIRCULAR_SOURCE_LABEL_AR[c.sourceType]}</span>
                    <span>تاريخ الإصدار: {c.issueDate}</span>
                    {c.referenceNumber && <span>المرجع: {c.referenceNumber}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
