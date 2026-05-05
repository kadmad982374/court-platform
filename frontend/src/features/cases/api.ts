import { http } from '@/shared/api/http';
import type {
  CaseStage,
  CreateCaseRequest,
  DecisionType,
  ExecutionFile,
  LitigationCase,
  PageResponse,
  PromoteToAppealResponse,
  PromoteToExecutionRequest,
  UpdateCaseBasicDataRequest,
} from '@/shared/types/domain';

/** PR-9 (customer feedback A-3 / B-1 / C-1 / D-1) — explicit filters layered on
 *  top of the implicit role scope. All four are optional. The empty-string
 *  shape is preferred over undefined keys to keep the URL deterministic. */
export interface ListCasesFilters {
  branchId?: number;
  departmentId?: number;
  courtId?: number;
  /** free-text search across publicEntityName / opponentName / originalBasisNumber */
  q?: string;
}

export async function listCases(
  page: number,
  size: number,
  filters: ListCasesFilters = {},
): Promise<PageResponse<LitigationCase>> {
  const params: Record<string, string | number> = { page, size };
  if (filters.branchId     != null) params.branchId     = filters.branchId;
  if (filters.departmentId != null) params.departmentId = filters.departmentId;
  if (filters.courtId      != null) params.courtId      = filters.courtId;
  if (filters.q && filters.q.trim()) params.q = filters.q.trim();
  const r = await http.get<PageResponse<LitigationCase>>('/cases', { params });
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

/** PR-11 (customer feedback C-6) — patch payload for finalized-case correction. */
export interface CorrectFinalizedCaseRequest {
  originalBasisNumber?: string;
  basisYear?: number;
  stageBasisNumber?: string;
  stageYear?: number;
  decisionNumber?: string;
  /** ISO yyyy-MM-dd. */
  decisionDate?: string;
  decisionType?: DecisionType;
  /** BigDecimal serialised as string. */
  adjudgedAmount?: string;
  /** ISO 4217 alpha-3. */
  currencyCode?: string;
}

export async function correctFinalizedCase(
  caseId: number,
  body: CorrectFinalizedCaseRequest,
): Promise<LitigationCase> {
  const r = await http.patch<LitigationCase>(`/cases/${caseId}/correct`, body);
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

