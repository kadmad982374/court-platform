// UI sub-phase B — AdminUserDetailPage.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/shared/api/lookups', () => ({
  listBranches: vi.fn().mockResolvedValue([]),
  listDepartments: vi.fn().mockResolvedValue([]),
  listCourts: vi.fn().mockResolvedValue([]),
}));
vi.mock('../api/usersAdmin', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdmin')>('../api/usersAdmin');
  return { ...actual, getUserAdmin: vi.fn() };
});

import { getUserAdmin } from '../api/usersAdmin';
import { AdminUserDetailPage } from './AdminUserDetailPage';

function wrapAt(path: string, node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/admin/users/:id" element={node} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  (getUserAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 7, username: 'lawyer1', fullName: 'محامي ١', mobileNumber: '0912345678',
    active: true, locked: false, defaultBranchId: 1, defaultDepartmentId: 10,
    createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null,
    roles: ['STATE_LAWYER'],
    departmentMemberships: [{ id: 1, userId: 7, branchId: 1, departmentId: 10,
      membershipType: 'STATE_LAWYER', primary: true, active: true }],
    delegatedPermissions: [],
    courtAccess: [],
  });
});

describe('AdminUserDetailPage', () => {
  it('loads user and renders all 5 sections', async () => {
    wrapAt('/admin/users/7', <AdminUserDetailPage />);
    await waitFor(() => expect(screen.getByText('محامي ١')).toBeTruthy());
    expect(screen.getByTestId('admin-user-basic-section')).toBeTruthy();
    expect(screen.getByTestId('admin-roles-section')).toBeTruthy();
    expect(screen.getByTestId('admin-memberships-section')).toBeTruthy();
    expect(screen.getByTestId('admin-delegations-section')).toBeTruthy();
    expect(screen.getByTestId('admin-court-access-section')).toBeTruthy();
  });

  it('renders an error state when fetch fails', async () => {
    (getUserAdmin as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { code: 'NOT_FOUND', message: 'لم يُعثر على المستخدم' } },
    });
    wrapAt('/admin/users/9999', <AdminUserDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/لم يُعثر/);
    });
  });
});

