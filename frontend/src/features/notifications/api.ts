// Phase 10 — Notifications API client (Phase 6 backend, D-038).
//
// Bound endpoints:
//   GET   /api/v1/notifications?page=&size=
//   PATCH /api/v1/notifications/{id}/read
//
// NOT bound (per D-038): manual POST creation (forbidden), DELETE (none),
// batching/digest, push channels.

import { http } from '@/shared/api/http';
import type { Notification } from '@/shared/types/domain';

export interface ListNotificationsQuery {
  page?: number;
  size?: number;
}

export async function listNotifications(q: ListNotificationsQuery = {}): Promise<Notification[]> {
  const r = await http.get<Notification[]>('/notifications', {
    params: { page: q.page ?? 0, size: q.size ?? 20 },
  });
  return r.data;
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const r = await http.patch<Notification>(`/notifications/${id}/read`);
  return r.data;
}

