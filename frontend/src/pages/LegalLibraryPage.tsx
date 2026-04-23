import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '@/shared/api/http';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import type { LegalCategory, LegalLibraryItem, PageResponse } from '@/shared/types/domain';

/**
 * Phase 8 — initial read integration only. NOT a full business page.
 * Proves the Auth + API + React Query pipeline works end-to-end against the
 * real Phase 7 backend. Filters/search/details = Phase 9+.
 */
export function LegalLibraryPage() {
  const categoriesQ = useQuery({
    queryKey: ['legal-library', 'categories'],
    queryFn: () => apiGet<LegalCategory[]>('/legal-library/categories'),
  });

  const itemsQ = useQuery({
    queryKey: ['legal-library', 'items', { page: 0, size: 5 }],
    queryFn: () =>
      apiGet<PageResponse<LegalLibraryItem>>('/legal-library/items', { page: 0, size: 5 }),
  });

  return (
    <>
      <PageHeader
        title="المكتبة القانونية"
        subtitle="عرض أولي بسيط — التفاصيل والفلاتر تأتي في مراحل لاحقة."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الفئات</CardTitle>
          </CardHeader>
          <CardBody>
            {categoriesQ.isLoading && <Spinner className="text-brand-600" />}
            {categoriesQ.isError && <p className="text-sm text-red-600">تعذّر تحميل الفئات.</p>}
            {categoriesQ.data && (
              <ul className="space-y-1 text-sm text-slate-700">
                {categoriesQ.data.map((c) => (
                  <li key={c.id} className="border-b border-slate-100 py-1 last:border-0">
                    {c.nameAr}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أحدث العناصر</CardTitle>
          </CardHeader>
          <CardBody>
            {itemsQ.isLoading && <Spinner className="text-brand-600" />}
            {itemsQ.isError && <p className="text-sm text-red-600">تعذّر تحميل العناصر.</p>}
            {itemsQ.data && (
              <>
                <ul className="space-y-2 text-sm">
                  {itemsQ.data.content.map((it) => (
                    <li key={it.id} className="border-b border-slate-100 py-1 last:border-0">
                      <Link
                        to={`/legal-library/items/${it.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {it.title}
                      </Link>
                      {it.summary && (
                        <div className="mt-0.5 text-xs text-slate-500">{it.summary}</div>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-400">
                  الإجمالي: {itemsQ.data.totalElements}
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
