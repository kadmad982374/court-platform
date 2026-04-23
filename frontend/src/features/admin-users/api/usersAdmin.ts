// UI sub-phase B — typed clients for the Mini-Phase B backend admin
// endpoints. Do NOT introduce extra contracts here.
//
// Mapped 1-to-1 to:
//   POST   /api/v1/users
//   GET    /api/v1/users               (paginated, NO membershipType — that
//                                       parameter routes to the Mini-Phase A
//                                       handler in UsersController)
//   GET    /api/v1/users/{id}
//   PATCH  /api/v1/users/{id}
//   POST   /api/v1/users/{id}/roles
//   DELETE /api/v1/users/{id}/roles/{role}
//   POST   /api/v1/users/{id}/department-memberships
//   PATCH  /api/v1/users/{id}/department-memberships/{mid}
//   POST   /api/v1/users/{id}/delegated-permissions
//   PATCH  /api/v1/users/{id}/delegated-permissions/{pid}
//   POST   /api/v1/users/{id}/court-access
//   DELETE /api/v1/users/{id}/court-access/{caid}

import { http } from '@/shared/api/http';
import type {
  CourtAccess,
  DelegatedPermission,
  DepartmentMembership,
  PageResponse,
  RoleCode,
} from '@/shared/types/domain';

import type {
  AddCourtAccessRequest,
  AddDelegatedPermissionRequest,
  CreateMembershipRequest,
  CreateUserRequest,
  UpdateDelegatedPermissionRequest,
  UpdateMembershipRequest,
  UpdateUserRequest,
  UserAdminDto,
  UserSummaryDto,
} from './types';

/** Filters accepted by the backend admin list. */
export interface AdminUsersListParams {
  role?: RoleCode;
  branchId?: number;
  departmentId?: number;
  active?: boolean;
  q?: string;
  page: number;
  size: number;
}

export async function listUsersAdmin(
  params: AdminUsersListParams,
): Promise<PageResponse<UserSummaryDto>> {
  // Strip undefined entries — axios serialises them as `key=` otherwise.
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v as never;
  }
  const r = await http.get<PageResponse<UserSummaryDto>>('/users', { params: cleaned });
  return r.data;
}

export async function getUserAdmin(id: number): Promise<UserAdminDto> {
  const r = await http.get<UserAdminDto>(`/users/${id}`);
  return r.data;
}

export async function createUser(body: CreateUserRequest): Promise<{ id: number }> {
  const r = await http.post<{ id: number }>('/users', body);
  return r.data;
}

export async function patchUser(
  id: number, body: UpdateUserRequest,
): Promise<UserAdminDto> {
  const r = await http.patch<UserAdminDto>(`/users/${id}`, body);
  return r.data;
}

export async function addRole(id: number, role: RoleCode): Promise<void> {
  await http.post(`/users/${id}/roles`, { role });
}

export async function removeRole(id: number, role: RoleCode): Promise<void> {
  await http.delete(`/users/${id}/roles/${role}`);
}

export async function addMembership(
  id: number, body: CreateMembershipRequest,
): Promise<DepartmentMembership> {
  const r = await http.post<DepartmentMembership>(
    `/users/${id}/department-memberships`, body,
  );
  return r.data;
}

export async function patchMembership(
  id: number, mid: number, body: UpdateMembershipRequest,
): Promise<DepartmentMembership> {
  const r = await http.patch<DepartmentMembership>(
    `/users/${id}/department-memberships/${mid}`, body,
  );
  return r.data;
}

export async function addDelegated(
  id: number, body: AddDelegatedPermissionRequest,
): Promise<DelegatedPermission> {
  const r = await http.post<DelegatedPermission>(
    `/users/${id}/delegated-permissions`, body,
  );
  return r.data;
}

export async function patchDelegated(
  id: number, pid: number, body: UpdateDelegatedPermissionRequest,
): Promise<DelegatedPermission> {
  const r = await http.patch<DelegatedPermission>(
    `/users/${id}/delegated-permissions/${pid}`, body,
  );
  return r.data;
}

export async function addCourtAccess(
  id: number, body: AddCourtAccessRequest,
): Promise<CourtAccess> {
  const r = await http.post<CourtAccess>(`/users/${id}/court-access`, body);
  return r.data;
}

export async function removeCourtAccess(
  id: number, caid: number,
): Promise<void> {
  await http.delete(`/users/${id}/court-access/${caid}`);
}

