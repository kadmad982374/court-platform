// UI sub-phase B — MembershipsSection: branch/dept cascade + duplicate handling.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/shared/api/lookups', () => ({
  listBranches: vi.fn().mockResolvedValue([{ id: 1, code: 'D', nameAr: 'دمشق', active: true }]),
  listDepartments: vi.fn().mockResolvedValue([
    { id: 10, branchId: 1, code: 'FI', nameAr: 'بداية', type: 'FIRST_INSTANCE', active: true },
  ]),
}));
vi.mock('../api/usersAdmin', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdmin')>('../api/usersAdmin');
  return { ...actual, addMembership: vi.fn(), patchMembership: vi.fn() };
});

import { addMembership, patchMembership } from '../api/usersAdmin';
import { MembershipsSection } from './MembershipsSection';

function wrap(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  (addMembership   as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 50 });
  (patchMembership as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 50 });
});

describe('MembershipsSection', () => {
  it('forces departmentId=null when membership type is BRANCH_HEAD', async () => {
    wrap(<MembershipsSection userId={1} memberships={[]} />);
    // Wait for branches lookup to populate.
    await waitFor(() => {
      expect((screen.getByLabelText('membership-branch') as HTMLSelectElement).options.length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText('membership-type'), { target: { value: 'BRANCH_HEAD' } });
    fireEvent.change(screen.getByLabelText('membership-branch'), { target: { value: '1' } });

    const dept = screen.getByLabelText('membership-department') as HTMLSelectElement;
    expect(dept.disabled).toBe(true);

    fireEvent.submit(screen.getByTestId('admin-memberships-add-form'));
    await waitFor(() =>
      expect(addMembership).toHaveBeenCalledWith(1, expect.objectContaining({
        membershipType: 'BRANCH_HEAD', departmentId: null, branchId: 1,
      })),
    );
  });

  it('rejects non-BRANCH_HEAD without departmentId', async () => {
    wrap(<MembershipsSection userId={1} memberships={[]} />);
    await waitFor(() => {
      expect((screen.getByLabelText('membership-branch') as HTMLSelectElement).options.length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText('membership-type'), { target: { value: 'SECTION_HEAD' } });
    fireEvent.change(screen.getByLabelText('membership-branch'), { target: { value: '1' } });
    fireEvent.submit(screen.getByTestId('admin-memberships-add-form'));
    await waitFor(() => {
      expect(screen.getByText(/اختر القسم/)).toBeTruthy();
    });
    expect(addMembership).not.toHaveBeenCalled();
  });

  it('toggle active triggers PATCH', async () => {
    wrap(
      <MembershipsSection
        userId={1}
        memberships={[{ id: 7, userId: 1, branchId: 1, departmentId: 10,
          membershipType: 'STATE_LAWYER', primary: false, active: true }]}
      />,
    );
    fireEvent.click(screen.getByLabelText('toggle-active-7'));
    await waitFor(() => expect(patchMembership).toHaveBeenCalledWith(1, 7, { active: false }));
  });
});

