import { http } from '@/shared/api/http';
import type {
  CaseStage,
  CreateCaseRequest,
  ExecutionFile,
  LitigationCase,
  PageResponse,
  PromoteToAppealResponse,
  PromoteToExecutionRequest,
  UpdateCaseBasicDataRequest,
} from '@/shared/types/domain';

export async function listCases(page: number, size: number): Promise<PageResponse<LitigationCase>> {
  const r = await http.get<PageResponse<LitigationCase>>('/cases', { params: { page, size } });
  return r.data;
}

export async function getCase(id: number): Promise<LitigationCase> {
  const r = await http.get<LitigationCase>(`/cases/${id}`);
  return r.data;
}

export async function listCaseStages(id: number): Promise<CaseStage[]> {
  const r = await http.get<CaseStage[]>(`/cases/${id}/stages`);
  return r.data;
}

export async function promoteToAppeal(caseId: number): Promise<PromoteToAppealResponse> {
  const r = await http.post<PromoteToAppealResponse>(`/cases/${caseId}/promote-to-appeal`);
  return r.data;
}

export async function promoteToExecution(
  caseId: number,
  body: PromoteToExecutionRequest,
): Promise<ExecutionFile> {
  const r = await http.post<ExecutionFile>(`/cases/${caseId}/promote-to-execution`, body);
  return r.data;
}

// Phase 11 — admin write APIs (existing backend contracts).
export async function createCase(body: CreateCaseRequest): Promise<LitigationCase> {
  const r = await http.post<LitigationCase>('/cases', body);
  return r.data;
}

export async function updateCaseBasicData(
  caseId: number,
  body: UpdateCaseBasicDataRequest,
): Promise<LitigationCase> {
  const r = await http.put<LitigationCase>(`/cases/${caseId}/basic-data`, body);
  return r.data;
}

// Mini-Phase A — Assign Lawyer (D-046).
// Backend contract (Phase 2, unchanged): POST /cases/{id}/assign-lawyer
//   body = { lawyerUserId: number }
export async function assignLawyer(
  caseId: number,
  lawyerUserId: number,
): Promise<LitigationCase> {
  const r = await http.post<LitigationCase>(`/cases/${caseId}/assign-lawyer`, { lawyerUserId });
  return r.data;
}

