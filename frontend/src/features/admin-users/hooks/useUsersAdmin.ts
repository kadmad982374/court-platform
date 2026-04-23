// UI sub-phase B — TanStack Query hooks for the admin-users module.
//
// Centralizes query keys + invalidation rules so components stay simple.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  addCourtAccess,
  addDelegated,
  addMembership,
  addRole,
  createUser,
  getUserAdmin,
  listUsersAdmin,
  patchDelegated,
  patchMembership,
  patchUser,
  removeCourtAccess,
  removeRole,
  type AdminUsersListParams,
} from '../api/usersAdmin';

// ---------- query keys ----------
export const adminUsersKeys = {
  root:   ['admin-users'] as const,
  list:   (filters: AdminUsersListParams) => ['admin-users', 'list', filters] as const,
  detail: (id: number) => ['admin-users', 'detail', id] as const,
};

export function invalidateAdminUsers(qc: QueryClient, id?: number): void {
  void qc.invalidateQueries({ queryKey: adminUsersKeys.root });
  if (id != null) void qc.invalidateQueries({ queryKey: adminUsersKeys.detail(id) });
}

// ---------- queries ----------
export function useUsersAdminList(filters: AdminUsersListParams) {
  return useQuery({
    queryKey: adminUsersKeys.list(filters),
    queryFn:  () => listUsersAdmin(filters),
    staleTime: 15_000,
  });
}

export function useUserAdmin(id: number | null) {
  return useQuery({
    queryKey: id != null ? adminUsersKeys.detail(id) : ['admin-users', 'detail', 'none'],
    queryFn:  () => getUserAdmin(id as number),
    enabled:  id != null,
    staleTime: 30_000,
  });
}

// ---------- mutations ----------
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    // Wrap to ensure only the `variables` arg reaches the API client
    // (TanStack Query v5 passes a context object as the second arg).
    mutationFn: (body: Parameters<typeof createUser>[0]) => createUser(body),
    onSuccess:  () => invalidateAdminUsers(qc),
  });
}

export function usePatchUser(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof patchUser>[1]) => patchUser(id, body),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function useAddRole(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: Parameters<typeof addRole>[1]) => addRole(id, role),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function useRemoveRole(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: Parameters<typeof removeRole>[1]) => removeRole(id, role),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function useAddMembership(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof addMembership>[1]) => addMembership(id, body),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function usePatchMembership(id: number, mid: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof patchMembership>[2]) => patchMembership(id, mid, body),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function useAddDelegated(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof addDelegated>[1]) => addDelegated(id, body),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function usePatchDelegated(id: number, pid: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof patchDelegated>[2]) => patchDelegated(id, pid, body),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function useAddCourtAccess(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof addCourtAccess>[1]) => addCourtAccess(id, body),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}

export function useRemoveCourtAccess(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caid: number) => removeCourtAccess(id, caid),
    onSuccess:  () => invalidateAdminUsers(qc, id),
  });
}


