// UI sub-phase B — RolesSection: add idempotent + remove + error.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/usersAdmin', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdmin')>('../api/usersAdmin');
  return { ...actual, addRole: vi.fn(), removeRole: vi.fn() };
});

import { addRole, removeRole } from '../api/usersAdmin';
import { RolesSection } from './RolesSection';

function wrap(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  (addRole    as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (removeRole as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe('RolesSection', () => {
  it('renders existing roles and supports add', async () => {
    wrap(<RolesSection userId={1} roles={['STATE_LAWYER']} />);
    expect(screen.getByTestId('admin-roles-list').textContent).toMatch(/محامي الدولة/);

    const select = screen.getByLabelText('role-picker') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'SECTION_HEAD' } });
    fireEvent.submit(screen.getByTestId('admin-roles-add-form'));

    await waitFor(() => expect(addRole).toHaveBeenCalledWith(1, 'SECTION_HEAD'));
  });

  it('removes a role on click', async () => {
    wrap(<RolesSection userId={2} roles={['SECTION_HEAD']} />);
    fireEvent.click(screen.getByLabelText('remove-SECTION_HEAD'));
    await waitFor(() => expect(removeRole).toHaveBeenCalledWith(2, 'SECTION_HEAD'));
  });

  it('surfaces D-048 error from backend', async () => {
    (addRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { code: 'BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD', message: 'ممنوع منح BRANCH_HEAD' } },
    });
    wrap(<RolesSection userId={1} roles={[]} />);
    const select = screen.getByLabelText('role-picker') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'BRANCH_HEAD' } });
    fireEvent.submit(screen.getByTestId('admin-roles-add-form'));
    await waitFor(() => {
      expect(screen.getByTestId('admin-roles-error').textContent).toMatch(/ممنوع منح/);
    });
  });
});

