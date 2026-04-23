// Phase 10 — CircularDetailPage (Phase 7 read-only, D-042).

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCircular } from '@/features/knowledge/api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { CIRCULAR_SOURCE_LABEL_AR } from '@/shared/types/domain';

export function CircularDetailPage() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);

  const q = useQuery({
    queryKey: ['circulars', cid],
    queryFn: () => getCircular(cid),
    enabled: Number.isFinite(cid),
  });

  if (!Number.isFinite(cid)) return <p className="text-sm text-red-600">معرّف غير صالح.</p>;

  return (
    <>
      <PageHeader
        title={q.data?.title ?? `تعميم #${cid}`}
        subtitle={q.data?.summary ?? 'تفاصيل التعميم.'}
      />
      <div className="mb-3">
        <Link to="/circulars">
          <Button variant="ghost" size="sm">→ العودة للقائمة</Button>
        </Link>
      </div>

      {q.isLoading && <Spinner className="text-brand-600" />}
      {q.isError && (
        <p className="text-sm text-red-600">{extractApiErrorMessage(q.error, 'تعذّر تحميل التعميم.')}</p>
      )}
      {q.data && (
        <Card>
          <CardHeader><CardTitle>المحتوى الكامل</CardTitle></CardHeader>
          <CardBody>
            <dl className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Field k="جهة الإصدار"  v={CIRCULAR_SOURCE_LABEL_AR[q.data.sourceType]} />
              <Field k="تاريخ الإصدار" v={q.data.issueDate} />
              <Field k="رقم المرجع"   v={q.data.referenceNumber ?? '—'} />
              <Field k="الكلمات المفتاحية" v={q.data.keywords ?? '—'} />
              <Field k="نشط؟"          v={q.data.active ? 'نعم' : 'لا'} />
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

