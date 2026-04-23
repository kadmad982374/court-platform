import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '@/shared/api/http';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import type { PageResponse, PublicEntityItem } from '@/shared/types/domain';

/**
 * Phase 8 — minimal read integration only.
 */
export function PublicEntitiesPage() {
  const q = useQuery({
    queryKey: ['public-entities', { page: 0, size: 20 }],
    queryFn: () =>
      apiGet<PageResponse<PublicEntityItem>>('/public-entities', { page: 0, size: 20 }),
  });

  return (
    <>
      <PageHeader title="دليل الجهات العامة" subtitle="قائمة أولية بسيطة." />
      <Card>
        <CardHeader>
          <CardTitle>الجهات</CardTitle>
        </CardHeader>
        <CardBody>
          {q.isLoading && <Spinner className="text-brand-600" />}
          {q.isError && <p className="text-sm text-red-600">تعذّر تحميل الجهات.</p>}
          {q.data && (
            <ul className="divide-y divide-slate-100 text-sm">
              {q.data.content.map((e) => (
                <li key={e.id} className="py-2">
                  <Link
                    to={`/public-entities/${e.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {e.nameAr}
                  </Link>
                  {e.shortDescription && (
                    <div className="mt-0.5 text-xs text-slate-500">{e.shortDescription}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
