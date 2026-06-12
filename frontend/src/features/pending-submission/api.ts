// Phase 2 (#3) — تحت الرفع register (pending submissions).
//
// Backend contract:
//   GET  /api/v1/pending-submissions?q=&page=&size=  → PageResponse<PendingSubmission>
//   POST /api/v1/pending-submissions                 → PendingSubmission
//   PUT  /api/v1/pending-submissions/{id}            → PendingSubmission
//
// Uses the shared http client; no new infrastructure.

import { http } from '@/shared/api/http';
import type { PageResponse } from '@/shared/types/domain';

export interface PendingSubmission {
  id: number;
  incomingNumber: string;
  letterNumber: string;
  publicEntityName: string;
  opponentName: string;
  subject: string;
  notes: string;
  branchId: number;
  departmentId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePendingSubmissionRequest {
  branchId: number;
  departmentId: number;
  incomingNumber: string;
  letterNumber: string;
  publicEntityName: string;
  opponentName: string;
  subject: string;
  notes: string;
}

export interface ListPendingSubmissionsParams {
  /** Free-text search across رقم الوارد / رقم الكتاب / الجهة / الخصم. */
  q?: string;
  page?: number;
  size?: number;
}

export async function listPendingSubmissions(
  params: ListPendingSubmissionsParams = {},
): Promise<PageResponse<PendingSubmission>> {
  const query: Record<string, string | number> = {
    page: params.page ?? 0,
    size: params.size ?? 20,
  };
  if (params.q && params.q.trim()) query.q = params.q.trim();
  const r = await http.get<PageResponse<PendingSubmission>>('/pending-submissions', { params: query });
  return r.data;
}

export async function createPendingSubmission(
  body: CreatePendingSubmissionRequest,
): Promise<PendingSubmission> {
  const r = await http.post<PendingSubmission>('/pending-submissions', body);
  return r.data;
}

export async function updatePendingSubmission(
  id: number,
  body: CreatePendingSubmissionRequest,
): Promise<PendingSubmission> {
  const r = await http.put<PendingSubmission>(`/pending-submissions/${id}`, body);
  return r.data;
}
