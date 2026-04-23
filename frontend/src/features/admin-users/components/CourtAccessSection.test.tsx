// UI sub-phase B — CourtAccessSection.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/shared/api/lookups', () => ({
  listBranches: vi.fn().mockResolvedValue([{ id: 1, code: 'D', nameAr: 'دمشق', active: true }]),
  listCourts: vi.fn().mockResolvedValue([
    { id: 7, branchId: 1, departmentType: 'FIRST_INSTANCE', nameAr: 'بداية دمشق',
      chamberSupport: false, active: true },
  ]),
}));
vi.mock('../api/usersAdmin', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdmin')>('../api/usersAdmin');
  return { ...actual, addCourtAccess: vi.fn(), removeCourtAccess: vi.fn() };
});

import { addCourtAccess, removeCourtAccess } from '../api/usersAdmin';
import { CourtAccessSection } from './CourtAccessSection';

function wrap(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  (addCourtAccess    as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, active: true });
  (removeCourtAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe('CourtAccessSection', () => {
  it('grants court access', async () => {
    wrap(<CourtAccessSection userId={1} courtAccess={[]} />);
    await waitFor(() => {
      expect((screen.getByLabelText('court-branch') as HTMLSelectElement).options.length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText('court-branch'), { target: { value: '1' } });
    await waitFor(() => {
      expect((screen.getByLabelText('court-id') as HTMLSelectElement).options.length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText('court-id'), { target: { value: '7' } });
    fireEvent.submit(screen.getByTestId('admin-court-access-add-form'));
    await waitFor(() => expect(addCourtAccess).toHaveBeenCalledWith(1, { courtId: 7 }));
  });

  it('revokes court access (logical)', async () => {
    wrap(
      <CourtAccessSection
        userId={1}
        courtAccess={[{ id: 33, userId: 1, courtId: 7, grantedAt: '2026-01-01T00:00:00Z',
          grantedByUserId: null, active: true }]}
      />,
    );
    fireEvent.click(screen.getByLabelText('revoke-court-33'));
    await waitFor(() => expect(removeCourtAccess).toHaveBeenCalledWith(1, 33));
  });

  it('surfaces COURT_ACCESS_DUPLICATE message', async () => {
    (addCourtAccess as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { code: 'COURT_ACCESS_DUPLICATE', message: 'سبق منح هذا الوصول' } },
    });
    wrap(<CourtAccessSection userId={1} courtAccess={[]} />);
    await waitFor(() => {
      expect((screen.getByLabelText('court-branch') as HTMLSelectElement).options.length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText('court-branch'), { target: { value: '1' } });
    await waitFor(() => {
      expect((screen.getByLabelText('court-id') as HTMLSelectElement).options.length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText('court-id'), { target: { value: '7' } });
    fireEvent.submit(screen.getByTestId('admin-court-access-add-form'));
    await waitFor(() => {
      expect(screen.getByTestId('admin-court-access-error').textContent).toMatch(/سبق منح/);
    });
  });
});

