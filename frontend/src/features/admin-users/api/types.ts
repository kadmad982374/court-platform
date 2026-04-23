// UI sub-phase B — admin-users API DTOs.
//
// Mirrors backend records added in Backend Mini-Phase B:
//   sy.gov.sla.identity.api.{UserAdminDto, UserSummaryDto, CreateUserRequest,
//   UpdateUserRequest, CreateMembershipRequest, UpdateMembershipRequest,
//   AddDelegatedPermissionRequest, UpdateDelegatedPermissionRequest,
//   AddCourtAccessRequest, AssignRoleRequest}.
//
// IMPORTANT: shapes must match the backend exactly. Do NOT add fields that
// the backend does not return / accept.

import type {
  CourtAccess,
  DelegatedPermission,
  DelegatedPermissionCode,
  DepartmentMembership,
  MembershipType,
  RoleCode,
} from '@/shared/types/domain';

export interface UserSummaryDto {
  id: number;
  username: string;
  fullName: string;
  active: boolean;
  defaultBranchId: number | null;
  defaultDepartmentId: number | null;
  roles: RoleCode[];
}

export interface UserAdminDto {
  id: number;
  username: string;
  fullName: string;
  mobileNumber: string;
  active: boolean;
  locked: boolean;
  defaultBranchId: number | null;
  defaultDepartmentId: number | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  roles: RoleCode[];
  departmentMemberships: DepartmentMembership[];
  delegatedPermissions: DelegatedPermission[];
  courtAccess: CourtAccess[];
}

/** Body for `POST /api/v1/users` (D-047). */
export interface CreateUserRequest {
  username: string;
  fullName: string;
  mobileNumber: string;
  initialPassword: string;
  defaultBranchId?: number | null;
  defaultDepartmentId?: number | null;
  active?: boolean | null;
}

/** Body for `PATCH /api/v1/users/{id}` (admin-only fields). */
export interface UpdateUserRequest {
  active?: boolean;
  fullName?: string;
  mobileNumber?: string;
}

export interface CreateMembershipRequest {
  branchId: number;
  /** must be null for membershipType = BRANCH_HEAD; required otherwise. */
  departmentId: number | null;
  membershipType: MembershipType;
  primary?: boolean | null;
  active?: boolean | null;
}

export interface UpdateMembershipRequest {
  active?: boolean;
  primary?: boolean;
}

export interface AddDelegatedPermissionRequest {
  code: DelegatedPermissionCode;
  granted: boolean;
}

export interface UpdateDelegatedPermissionRequest {
  granted: boolean;
}

export interface AddCourtAccessRequest {
  courtId: number;
}

