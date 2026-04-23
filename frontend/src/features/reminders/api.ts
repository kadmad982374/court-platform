// Phase 10 — Reminders API client (Phase 6 backend, D-037).
//
// Bound endpoints:
//   POST  /api/v1/cases/{id}/reminders
//   GET   /api/v1/cases/{id}/reminders        (returns ONLY current user's)
//   PATCH /api/v1/reminders/{id}/status       (owner-only; PENDING → DONE/CANCELLED)
//
// NOT bound: shared reminders (don't exist), team-wide reminders (don't exist),
// reminder DELETE (not in backend), edit text/date (immutable).

import { http } from '@/shared/api/http';
import type {
  CreateReminderRequest,
  Reminder,
  UpdateReminderStatusRequest,
} from '@/shared/types/domain';

export async function listReminders(caseId: number): Promise<Reminder[]> {
  const r = await http.get<Reminder[]>(`/cases/${caseId}/reminders`);
  return r.data;
}

export async function createReminder(
  caseId: number, body: CreateReminderRequest,
): Promise<Reminder> {
  const r = await http.post<Reminder>(`/cases/${caseId}/reminders`, body);
  return r.data;
}

export async function updateReminderStatus(
  reminderId: number, body: UpdateReminderStatusRequest,
): Promise<Reminder> {
  const r = await http.patch<Reminder>(`/reminders/${reminderId}/status`, body);
  return r.data;
}

