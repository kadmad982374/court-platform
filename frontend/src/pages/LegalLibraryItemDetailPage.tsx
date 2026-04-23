// Phase 10 — LegalLibraryItemDetailPage (Phase 7 read-only, D-042).

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getLegalLibraryItem } from '@/features/knowledge/api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

export function LegalLibraryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = Number(id);

  const q = useQuery({
    queryKey: ['legal-library', 'items', itemId],
    queryFn: () => getLegalLibraryItem(itemId),
    enabled: Number.isFinite(itemId),
  });

  if (!Number.isFinite(itemId)) return <p className="text-sm text-red-600">معرّف غير صالح.</p>;

  return (
    <>
      <PageHeader
        title={q.data?.title ?? `عنصر مكتبة #${itemId}`}
        subtitle={q.data?.summary ?? 'تفاصيل عنصر المكتبة القانونية.'}
      />
      <div className="mb-3">
        <Link to="/legal-library">
          <Button variant="ghost" size="sm">→ العودة للقائمة</Button>
        </Link>
      </div>

      {q.isLoading && <Spinner className="text-brand-600" />}
      {q.isError && (
        <p className="text-sm text-red-600">{extractApiErrorMessage(q.error, 'تعذّر تحميل العنصر.')}</p>
      )}
      {q.data && (
        <Card>
          <CardHeader><CardTitle>المحتوى الكامل</CardTitle></CardHeader>
          <CardBody>
            <dl className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Field k="معرّف الفئة"  v={`#${q.data.categoryId}`} />
              <Field k="المرجع"      v={q.data.sourceReference ?? '—'} />
              <Field k="تاريخ النشر" v={q.data.publishedAt ?? '—'} />
              <Field k="الكلمات المفتاحية" v={q.data.keywords ?? '—'} />
              <Field k="نشط؟"        v={q.data.active ? 'نعم' : 'لا'} />
            </dl>
            <article className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-800">
              {q.data.bodyText}
            </article>
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-slate-800">{v}</dd>
    </div>
  );
}

