// UI sub-phase B — typed-client URL/params/body assertions.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/api/http', () => {
  const get    = vi.fn();
  const post   = vi.fn();
  const patch  = vi.fn();
  const del    = vi.fn();
  return { http: { get, post, patch, delete: del } };
});

import { http } from '@/shared/api/http';
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
} from './usersAdmin';

beforeEach(() => {
  vi.clearAllMocks();
  (http.get   as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  (http.post  as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  (http.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  (http.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ data: undefined });
});

describe('listUsersAdmin', () => {
  it('GETs /users without membershipType param (Mini-Phase B admin handler)', async () => {
    await listUsersAdmin({ page: 0, size: 20, role: 'STATE_LAWYER' });
    const [url, opts] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/users');
    expect(opts.params).toEqual({ page: 0, size: 20, role: 'STATE_LAWYER' });
    expect(opts.params.membershipType).toBeUndefined();
  });
  it('drops empty/null filters', async () => {
    await listUsersAdmin({ page: 1, size: 10, q: '', branchId: undefined as unknown as number });
    const [, opts] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.params).toEqual({ page: 1, size: 10 });
  });
});

describe('users CRUD', () => {
  it('createUser → POST /users with body', async () => {
    await createUser({
      username: 'u1', fullName: 'X', mobileNumber: '0912345678', initialPassword: 'Strong#1234',
    });
    expect(http.post).toHaveBeenCalledWith('/users', expect.objectContaining({
      username: 'u1', mobileNumber: '0912345678', initialPassword: 'Strong#1234',
    }));
  });
  it('patchUser → PATCH /users/{id}', async () => {
    await patchUser(7, { active: false });
    expect(http.patch).toHaveBeenCalledWith('/users/7', { active: false });
  });
  it('getUserAdmin → GET /users/{id}', async () => {
    await getUserAdmin(7);
    expect(http.get).toHaveBeenCalledWith('/users/7');
  });
});

describe('roles', () => {
  it('addRole posts body { role }', async () => {
    await addRole(1, 'BRANCH_HEAD');
    expect(http.post).toHaveBeenCalledWith('/users/1/roles', { role: 'BRANCH_HEAD' });
  });
  it('removeRole deletes by role enum value', async () => {
    await removeRole(1, 'STATE_LAWYER');
    expect(http.delete).toHaveBeenCalledWith('/users/1/roles/STATE_LAWYER');
  });
});

describe('memberships / delegations / court access', () => {
  it('addMembership', async () => {
    await addMembership(1, {
      branchId: 2, departmentId: 3, membershipType: 'SECTION_HEAD',
      primary: true, active: true,
    });
    expect(http.post).toHaveBeenCalledWith(
      '/users/1/department-memberships',
      expect.objectContaining({ branchId: 2, departmentId: 3, membershipType: 'SECTION_HEAD' }),
    );
  });
  it('patchMembership', async () => {
    await patchMembership(1, 9, { active: false });
    expect(http.patch).toHaveBeenCalledWith('/users/1/department-memberships/9', { active: false });
  });
  it('addDelegated', async () => {
    await addDelegated(1, { code: 'ASSIGN_LAWYER', granted: true });
    expect(http.post).toHaveBeenCalledWith(
      '/users/1/delegated-permissions', { code: 'ASSIGN_LAWYER', granted: true },
    );
  });
  it('patchDelegated', async () => {
    await patchDelegated(1, 5, { granted: false });
    expect(http.patch).toHaveBeenCalledWith(
      '/users/1/delegated-permissions/5', { granted: false },
    );
  });
  it('addCourtAccess', async () => {
    await addCourtAccess(1, { courtId: 11 });
    expect(http.post).toHaveBeenCalledWith('/users/1/court-access', { courtId: 11 });
  });
  it('removeCourtAccess', async () => {
    await removeCourtAccess(1, 22);
    expect(http.delete).toHaveBeenCalledWith('/users/1/court-access/22');
  });
});

