// Phase 10 — Attachments API client (Phase 6 backend, D-035 / D-036).
//
// Bound endpoints:
//   POST   /api/v1/stages/{stageId}/attachments            (multipart `file`)
//   GET    /api/v1/stages/{stageId}/attachments
//   POST   /api/v1/execution-files/{id}/attachments        (multipart `file`)
//   GET    /api/v1/execution-files/{id}/attachments
//   GET    /api/v1/attachments/{id}/download               (streamed binary)
//
// NOT bound (out of scope per D-036): DELETE / PUT / versioning.
// Download is performed via authenticated XHR (the bearer token must travel
// in the Authorization header — we therefore do NOT use a raw <a href> link).

import { http } from '@/shared/api/http';
import type { Attachment } from '@/shared/types/domain';

export async function listStageAttachments(stageId: number): Promise<Attachment[]> {
  const r = await http.get<Attachment[]>(`/stages/${stageId}/attachments`);
  return r.data;
}

export async function uploadStageAttachment(
  stageId: number, file: File,
): Promise<Attachment> {
  const fd = new FormData();
  fd.append('file', file);
  // Let axios/browser set the multipart boundary automatically.
  const r = await http.post<Attachment>(
    `/stages/${stageId}/attachments`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return r.data;
}

export async function listExecutionFileAttachments(fileId: number): Promise<Attachment[]> {
  const r = await http.get<Attachment[]>(`/execution-files/${fileId}/attachments`);
  return r.data;
}

export async function uploadExecutionFileAttachment(
  fileId: number, file: File,
): Promise<Attachment> {
  const fd = new FormData();
  fd.append('file', file);
  const r = await http.post<Attachment>(
    `/execution-files/${fileId}/attachments`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return r.data;
}

/**
 * Authenticated download. Triggers the browser "save as" via an in-memory
 * blob URL so the bearer token never leaks to a plain anchor.
 *
 * Backend sets `Content-Disposition: attachment; filename*=UTF-8''<encoded>`,
 * we re-use the original filename we already have on the listing.
 */
export async function downloadAttachment(att: Attachment): Promise<void> {
  const r = await http.get<Blob>(`/attachments/${att.id}/download`, {
    responseType: 'blob',
  });
  const blob = r.data;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = att.originalFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation so browsers can finish the navigation.
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

