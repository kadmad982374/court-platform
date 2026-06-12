// Phase 10 — NotificationsPage (Phase 6 D-038).
//
// Lists current user's notifications with simple page/size controls
// and a "تعليم كمقروء" action. Backend-enforced: only the recipient sees
// their own notifications and only the recipient may mark them as read.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { listNotifications, markNotificationRead } from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { cn } from '@/shared/lib/cn';
import { useAuth } from '@/features/auth/AuthContext';
import { canBroadcastNotification } from '@/features/auth/permissions';

const PAGE_SIZE = 20;

interface NotificationTarget {
  /** Router path to open. */
  path: string;
  /** Arabic action label, e.g. "فتح الدعوى". */
  label: string;
}

function notificationTarget(
  relatedEntityType: string | null | undefined,
  relatedEntityId: number | null | undefined,
): NotificationTarget | null {
  if (!relatedEntityType || relatedEntityId == null) return null;
  switch (relatedEntityType) {
    case 'LITIGATION_CASE': return { path: `/cases/${relatedEntityId}`,           label: 'فتح الدعوى' };
    case 'CASE_STAGE':      return { path: `/stages/${relatedEntityId}`,          label: 'فتح المرحلة' };
    case 'EXECUTION_FILE':  return { path: `/execution-files/${relatedEntityId}`, label: 'فتح ملف التنفيذ' };
    default: return null;
  }
}

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
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
        actions={
          // Client feedback: send-notification is now a button on this page,
          // gated to broadcast-capable roles. Backend re-validates per request.
          canBroadcastNotification(user) ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate('/notifications/broadcast')}
              data-testid="notifications-send-action"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              إرسال إشعار
            </Button>
          ) : undefined
        }
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
              {data.map((n) => {
                const target = notificationTarget(n.relatedEntityType, n.relatedEntityId);
                const openTarget = () => {
                  if (!target) return;
                  if (!n.read) markMut.mutate(n.id);
                  navigate(target.path);
                };
                return (
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
                      {target ? (
                        <button
                          type="button"
                          onClick={openTarget}
                          className="text-sm font-semibold text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-400 rounded"
                          data-testid="notification-open"
                        >
                          {n.title}
                        </button>
                      ) : (
                        <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                      )}
                      <span className="text-xs text-slate-400">[{n.notificationType}]</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      <span>أُنشئ: {n.createdAt}</span>
                      {n.readAt && <span>قُرئ: {n.readAt}</span>}
                      {n.relatedEntityType && !target && (
                        <span>
                          مرتبط بـ {n.relatedEntityType}
                          {n.relatedEntityId != null && ` #${n.relatedEntityId}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {target && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={openTarget}
                        data-testid="notification-open-action"
                      >
                        {target.label}
                      </Button>
                    )}
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
                );
              })}
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

