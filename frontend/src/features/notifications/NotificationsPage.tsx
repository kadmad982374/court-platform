// Phase 10 — NotificationsPage (Phase 6 D-038).
//
// Lists current user's notifications with simple page/size controls
// and a "تعليم كمقروء" action. Backend-enforced: only the recipient sees
// their own notifications and only the recipient may mark them as read.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listNotifications, markNotificationRead } from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { cn } from '@/shared/lib/cn';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);

  const queryKey = ['notifications', { page, size: PAGE_SIZE }] as const;

  const listQ = useQuery({
    queryKey,
    queryFn: () => listNotifications({ page, size: PAGE_SIZE }),
  });

  const [actionError, setActionError] = useState<string | null>(null);

  const markMut = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  const data = listQ.data ?? [];
  const hasMore = data.length === PAGE_SIZE;

  return (
    <>
      <PageHeader
        title="الإشعارات"
        subtitle="إشعارات داخلية بأحداث الدعاوى. الإنشاء يدويًا غير ممكن (D-038)."
      />

      {actionError && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>قائمة الإشعارات</CardTitle>
        </CardHeader>
        <CardBody>
          {listQ.isLoading && <Spinner className="text-brand-600" />}
          {listQ.isError && (
            <p className="text-sm text-red-600">تعذّر تحميل الإشعارات.</p>
          )}
          {listQ.data && data.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد إشعارات.</p>
          )}

          {data.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {data.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex items-start justify-between gap-3 py-3',
                    !n.read && 'bg-brand-50/40 px-2 -mx-2 rounded',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.read && (
                        <span
                          aria-label="غير مقروء"
                          className="inline-block h-2 w-2 rounded-full bg-brand-600"
                        />
                      )}
                      <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                      <span className="text-xs text-slate-400">[{n.notificationType}]</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      <span>أُنشئ: {n.createdAt}</span>
                      {n.readAt && <span>قُرئ: {n.readAt}</span>}
                      {n.relatedEntityType && (
                        <span>
                          مرتبط بـ {n.relatedEntityType}
                          {n.relatedEntityId != null && ` #${n.relatedEntityId}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {!n.read ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={markMut.isPending}
                        onClick={() => markMut.mutate(n.id)}
                      >
                        تعليم كمقروء
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">مقروء</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Simple pager — backend returns a flat list per page; we infer "more" from page being full. */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button
              size="sm" variant="ghost"
              disabled={page === 0 || listQ.isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >السابق</Button>
            <span className="text-xs text-slate-500">صفحة {page + 1}</span>
            <Button
              size="sm" variant="ghost"
              disabled={!hasMore || listQ.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >التالي</Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

