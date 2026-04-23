// Phase 11 — read-only organization lookups used by admin screens.
//
// Backend endpoints (existing — Phase 1):
//   GET /api/v1/branches
//   GET /api/v1/branches/{id}/departments
//   GET /api/v1/courts?branchId=...&departmentType=...
//
// No new contracts introduced here.

import { http } from '@/shared/api/http';
import type { Branch, Court, Department, DepartmentType } from '@/shared/types/domain';

export async function listBranches(): Promise<Branch[]> {
  const r = await http.get<Branch[]>('/branches');
  return r.data;
}

export async function listDepartments(branchId: number): Promise<Department[]> {
  const r = await http.get<Department[]>(`/branches/${branchId}/departments`);
  return r.data;
}

export async function listCourts(params: {
  branchId?: number;
  departmentType?: DepartmentType;
}): Promise<Court[]> {
  const r = await http.get<Court[]>('/courts', { params });
  return r.data;
}

