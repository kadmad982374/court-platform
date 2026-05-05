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

// PR-14 (customer feedback A-1 / Q-G expansion) — broadcast composer.

export type BroadcastScope = 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'USERS';

export interface BroadcastRecipient {
  userId: number;
  fullName: string;
  username: string;
  branchId: number;
  departmentId: number | null;
}

export interface BroadcastRequest {
  scope: BroadcastScope;
  branchId?: number;
  departmentId?: number;
  userIds?: number[];
  title: string;
  body: string;
}

export interface BroadcastResult {
  recipientCount: number;
}

export async function listBroadcastRecipients(
  branchId?: number, departmentId?: number,
): Promise<BroadcastRecipient[]> {
  const params: Record<string, number> = {};
  if (branchId)     params.branchId = branchId;
  if (departmentId) params.departmentId = departmentId;
  const r = await http.get<BroadcastRecipient[]>(
    '/notifications/broadcast/recipients', { params });
  return r.data;
}

export async function sendBroadcast(req: BroadcastRequest): Promise<BroadcastResult> {
  const r = await http.post<BroadcastResult>('/notifications/broadcast', req);
  return r.data;
}

