import { http } from '@/shared/api/http';
import type {
  AddExecutionStepRequest,
  ExecutionFile,
  ExecutionFileStatus,
  ExecutionStep,
} from '@/shared/types/domain';

export interface ListExecutionFilesQuery {
  branchId?: number;
  departmentId?: number;
  status?: ExecutionFileStatus;
  year?: number;
  page?: number;
  size?: number;
}

export async function listExecutionFiles(q: ListExecutionFilesQuery): Promise<ExecutionFile[]> {
  const r = await http.get<ExecutionFile[]>('/execution-files', { params: q });
  return r.data;
}

export async function getExecutionFile(id: number): Promise<ExecutionFile> {
  const r = await http.get<ExecutionFile>(`/execution-files/${id}`);
  return r.data;
}

export async function listExecutionSteps(id: number): Promise<ExecutionStep[]> {
  const r = await http.get<ExecutionStep[]>(`/execution-files/${id}/steps`);
  return r.data;
}

export async function addExecutionStep(
  id: number, body: AddExecutionStepRequest,
): Promise<ExecutionStep> {
  const r = await http.post<ExecutionStep>(`/execution-files/${id}/steps`, body);
  return r.data;
}

