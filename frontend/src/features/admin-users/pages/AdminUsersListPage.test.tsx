// UI sub-phase B — AdminUsersListPage.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/shared/api/lookups', () => ({
  listBranches: vi.fn().mockResolvedValue([{ id: 1, code: 'D', nameAr: 'دمشق', active: true }]),
  listDepartments: vi.fn().mockResolvedValue([]),
}));
vi.mock('../api/usersAdmin', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdmin')>('../api/usersAdmin');
  return { ...actual, listUsersAdmin: vi.fn() };
});

import { listUsersAdmin } from '../api/usersAdmin';
import { AdminUsersListPage } from './AdminUsersListPage';

function wrap(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  (listUsersAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
    content: [
      { id: 1, username: 'central', fullName: 'مركزي', active: true,
        defaultBranchId: null, defaultDepartmentId: null, roles: ['CENTRAL_SUPERVISOR'] },
    ],
    page: 0, size: 20, totalElements: 1, totalPages: 1,
  });
});

describe('AdminUsersListPage', () => {
  it('renders the table from backend', async () => {
    wrap(<AdminUsersListPage />);
    await waitFor(() => {
      expect(screen.getByTestId('admin-users-table').textContent).toMatch(/مركزي/);
    });
    expect(screen.getByTestId('admin-users-page')).toBeTruthy();
    expect(screen.getByTestId('admin-users-create-button')).toBeTruthy();
  });

  it('applies the role filter and re-queries', async () => {
    wrap(<AdminUsersListPage />);
    await waitFor(() => expect(listUsersAdmin).toHaveBeenCalled());
    (listUsersAdmin as ReturnType<typeof vi.fn>).mockClear();

    fireEvent.change(screen.getByLabelText('filter-role'), { target: { value: 'STATE_LAWYER' } });
    await waitFor(() => {
      const lastCall = (listUsersAdmin as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
      expect(lastCall.role).toBe('STATE_LAWYER');
      expect(lastCall.page).toBe(0);
    });
  });

  it('renders error state on failure', async () => {
    (listUsersAdmin as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { code: 'X', message: 'فشل التحميل' } },
    });
    wrap(<AdminUsersListPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/فشل التحميل/);
    });
  });

  it('opens the create modal on click', async () => {
    wrap(<AdminUsersListPage />);
    fireEvent.click(screen.getByTestId('admin-users-create-button'));
    await waitFor(() => {
      expect(screen.getByTestId('admin-user-form')).toBeTruthy();
    });
  });
});

