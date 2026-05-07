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

export type BroadcastScope =
  | 'ALL'
  | 'BRANCH'
  | 'DEPARTMENT'
  | 'USERS'
  /** PR-15a iteration: accumulative union of branches + sections + named users. */
  | 'CUSTOM';

export interface BroadcastRecipient {
  userId: number;
  fullName: string;
  username: string;
  branchId: number;
  departmentId: number | null;
}

export interface BroadcastRequest {
  scope: BroadcastScope;
  /** Legacy single-target fields — kept for backwards compat. */
  branchId?: number;
  departmentId?: number;
  /** PR-15a: multi-target — admin can hit several branches/sections in one go. */
  branchIds?: number[];
  departmentIds?: number[];
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

/**
 * PR-15a iteration: union-aware recipient preview. The server returns the
 * deduplicated set of lawyers reachable by the given combination of branches,
 * sections, and named user ids — same union the CUSTOM-scope broadcast will
 * actually send to.
 */
export async function listBroadcastRecipientsUnion(
  branchIds: number[],
  departmentIds: number[],
  userIds: number[],
): Promise<BroadcastRecipient[]> {
  const params = new URLSearchParams();
  branchIds.forEach((id) => params.append('branchIds', String(id)));
  departmentIds.forEach((id) => params.append('departmentIds', String(id)));
  userIds.forEach((id) => params.append('userIds', String(id)));
  const r = await http.get<BroadcastRecipient[]>(
    '/notifications/broadcast/recipients-union', { params });
  return r.data;
}

export async function sendBroadcast(req: BroadcastRequest): Promise<BroadcastResult> {
  const r = await http.post<BroadcastResult>('/notifications/broadcast', req);
  return r.data;
}

